import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncKanbanFromSocial } from "@/lib/socialKanbanSync";


export type SocialPostStatus = "draft" | "pending_approval" | "approved" | "scheduled" | "publishing" | "published" | "error" | "cancelled";

export interface SocialPost {
  id: string;
  client_id: string;
  meta_page_id: string | null;
  platform: string;
  status: SocialPostStatus;
  caption: string;
  media_urls: string[];
  media_type: string;
  scheduled_at: string | null;
  published_at: string | null;
  meta_post_id: string | null;
  notes: string;
  error_message: string | null;
  retry_count: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
  } | null;
  meta_pages?: {
    page_name: string;
    platform: string;
    instagram_username: string | null;
  } | null;
}

export interface MetaPage {
  id: string;
  meta_account_id: string;
  client_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
  platform: string;
  meta_accounts?: {
    meta_user_name: string;
    token_expires_at: string | null;
  };
}

export function useSocialPosts(clientId: string | null) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("social_posts")
      .select("*, meta_pages(page_name, platform, instagram_username), clients(name)")
      .order("created_at", { ascending: false });
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    const { data } = await query as any;
    setPosts(data || []);
    setLoading(false);
  }, [clientId]);

  const fetchPages = useCallback(async () => {
    let query = supabase
      .from("meta_pages")
      .select("id, meta_account_id, client_id, page_id, page_name, instagram_account_id, instagram_username, platform, created_at, meta_accounts(meta_user_name, token_expires_at)")
      .order("page_name", { ascending: true });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data } = await query as any;
    setPages(data || []);
  }, [clientId]);

  useEffect(() => {
    fetchPosts();
    if (clientId) fetchPages();
  }, [clientId, fetchPosts, fetchPages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`social_posts_changes_${clientId || "all"}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "social_posts",
        ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}),
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, fetchPosts]);

  const createPost = async (post: Partial<SocialPost>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("social_posts").insert({
      client_id: clientId,
      ...post,
      created_by: user?.id,
    } as any).select().single();

    if (!error && data) {
      await supabase.from("social_post_history").insert({
        social_post_id: (data as any).id,
        new_status: "draft",
        changed_by: user?.id,
        change_note: "Post created",
      } as any);
    }
    fetchPosts();
    return { data, error };
  };

  const updatePost = async (id: string, updates: Partial<SocialPost>) => {
    const { data: existing } = await supabase.from("social_posts").select("status").eq("id", id).single() as any;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("social_posts").update(updates as any).eq("id", id);

    if (!error && updates.status && existing && updates.status !== existing.status) {
      await supabase.from("social_post_history").insert({
        social_post_id: id,
        old_status: existing.status,
        new_status: updates.status,
        changed_by: user?.id,
        change_note: `Status changed to ${updates.status}`,
      } as any);
    }

    // Reflect changes onto matching kanban card (deadline / status tags)
    if (!error) {
      const { data: full } = await supabase
        .from("social_posts")
        .select("id, client_id, caption, status, scheduled_at, published_at")
        .eq("id", id)
        .single() as any;
      if (full) await syncKanbanFromSocial(full);
    }

    fetchPosts();
    return { error };
  };


  const deletePost = async (id: string) => {
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    fetchPosts();
    return { error };
  };

  const duplicatePost = async (post: SocialPost) => {
    return createPost({
      platform: post.platform,
      caption: post.caption,
      media_urls: post.media_urls,
      media_type: post.media_type,
      meta_page_id: post.meta_page_id,
      notes: post.notes,
    });
  };

  const publishPost = async (id: string, publishNow = false) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/social-publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: publishNow ? "publish_now" : "publish", post_id: id }),
    });
    const result = await res.json();
    fetchPosts();
    return result;
  };

  const cancelPost = async (id: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/social-publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: "cancel", post_id: id }),
    });
    const result = await res.json();
    fetchPosts();
    return result;
  };

  const approvePost = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    return updatePost(id, {
      status: "approved",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    } as any);
  };

  return {
    posts,
    pages,
    loading,
    fetchPosts,
    fetchPages,
    createPost,
    updatePost,
    deletePost,
    duplicatePost,
    publishPost,
    cancelPost,
    approvePost,
  };
}
