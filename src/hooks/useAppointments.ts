import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppointmentTag {
  id: string;
  name: string;
  color: string;
}

export interface Appointment {
  id: string;
  userId: string;
  title: string;
  description: string;
  appointmentDate: string;
  appointmentTime: string;
  category: string;
  completed: boolean;
  completedAt: Date | null;
  cancelled: boolean;
  cancelledAt: Date | null;
  createdAt: Date;
  tagId: string | null;
}

interface CreateAppointment {
  title: string;
  description?: string;
  appointmentDate: string;
  appointmentTime: string;
  category?: string;
  tagId?: string | null;
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tags, setTags] = useState<AppointmentTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setTags([]);
      return;
    }

    const { data, error } = await supabase
      .from("appointment_tags" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .order("name");

    if (!error && data) {
      setTags(
        (data as any[]).map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
        })),
      );
    } else {
      setTags([]);
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("user_id", session.user.id)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (!error && data) {
      setAppointments(
        data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          title: r.title,
          description: r.description || "",
          appointmentDate: r.appointment_date,
          appointmentTime:
            r.appointment_time?.slice(0, 5) || "09:00",
          category: r.category || "",
          completed: !!r.completed,
          completedAt: r.completed_at
            ? new Date(r.completed_at)
            : null,
          cancelled: !!r.cancelled,
          cancelledAt: r.cancelled_at
            ? new Date(r.cancelled_at)
            : null,
          createdAt: new Date(r.created_at),
          tagId: r.tag_id || null,
        })),
      );
    } else {
      setAppointments([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchTags();
  }, [fetchAppointments, fetchTags]);

  const createAppointment = useCallback(
    async (input: CreateAppointment) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return false;

      const { error } = await supabase
        .from("appointments")
        .insert({
          user_id: session.user.id,
          title: input.title,
          description: input.description || "",
          appointment_date: input.appointmentDate,
          appointment_time: input.appointmentTime,
          category: input.category || "",
          tag_id: input.tagId || null,
        } as any);

      if (!error) {
        await fetchAppointments();
      }

      return !error;
    },
    [fetchAppointments],
  );

  const createBatch = useCallback(
    async (inputs: CreateAppointment[]) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || inputs.length === 0) {
        return false;
      }

      const rows = inputs.map((input) => ({
        user_id: session.user.id,
        title: input.title,
        description: input.description || "",
        appointment_date: input.appointmentDate,
        appointment_time: input.appointmentTime,
        category: input.category || "",
        tag_id: input.tagId || null,
      }));

      const { error } = await supabase
        .from("appointments")
        .insert(rows as any);

      if (!error) {
        await fetchAppointments();
      }

      return !error;
    },
    [fetchAppointments],
  );

  const toggleComplete = useCallback(
    async (id: string, completed: boolean) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const updates: Record<string, any> = {
        completed,
        completed_at: completed
          ? new Date().toISOString()
          : null,
        cancelled: false,
        cancelled_at: null,
      };

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                completed,
                completedAt: completed
                  ? new Date()
                  : null,
                cancelled: false,
                cancelledAt: null,
              }
            : a,
        ),
      );

      await supabase
        .from("appointments")
        .update(updates as any)
        .eq("id", id)
        .eq("user_id", session.user.id);
    },
    [],
  );

  const toggleCancelled = useCallback(
    async (id: string, cancelled: boolean) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const updates: Record<string, any> = {
        cancelled,
        cancelled_at: cancelled
          ? new Date().toISOString()
          : null,
        completed: false,
        completed_at: null,
      };

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                cancelled,
                cancelledAt: cancelled
                  ? new Date()
                  : null,
                completed: false,
                completedAt: null,
              }
            : a,
        ),
      );

      await supabase
        .from("appointments")
        .update(updates as any)
        .eq("id", id)
        .eq("user_id", session.user.id);
    },
    [],
  );

  const deleteAppointment = useCallback(
    async (id: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setAppointments((prev) =>
        prev.filter((a) => a.id !== id),
      );

      await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
    },
    [],
  );

  const updateAppointment = useCallback(
    async (
      id: string,
      updates: Partial<CreateAppointment>,
    ) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const dbUpdates: Record<string, any> = {};

      if (updates.title !== undefined) {
        dbUpdates.title = updates.title;
      }

      if (updates.description !== undefined) {
        dbUpdates.description = updates.description;
      }

      if (updates.appointmentDate !== undefined) {
        dbUpdates.appointment_date =
          updates.appointmentDate;
      }

      if (updates.appointmentTime !== undefined) {
        dbUpdates.appointment_time =
          updates.appointmentTime;
      }

      if (updates.category !== undefined) {
        dbUpdates.category = updates.category;
      }

      if (updates.tagId !== undefined) {
        dbUpdates.tag_id = updates.tagId;
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, ...updates }
            : a,
        ),
      );

      await supabase
        .from("appointments")
        .update(dbUpdates as any)
        .eq("id", id)
        .eq("user_id", session.user.id);
    },
    [],
  );

  const createTag = useCallback(
    async (name: string, color: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return null;

      const { data, error } = await supabase
        .from("appointment_tags" as any)
        .insert({
          user_id: session.user.id,
          name,
          color,
        } as any)
        .select()
        .single();

      if (!error && data) {
        const tag = {
          id: (data as any).id,
          name: (data as any).name,
          color: (data as any).color,
        };

        setTags((prev) =>
          [...prev, tag].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );

        return tag;
      }

      return null;
    },
    [],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setTags((prev) =>
        prev.filter((t) => t.id !== id),
      );

      setAppointments((prev) =>
        prev.map((a) =>
          a.tagId === id
            ? { ...a, tagId: null }
            : a,
        ),
      );

      await supabase
        .from("appointment_tags" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
    },
    [],
  );

  return {
    appointments,
    tags,
    loading,
    createAppointment,
    createBatch,
    toggleComplete,
    toggleCancelled,
    deleteAppointment,
    updateAppointment,
    createTag,
    deleteTag,
    refetch: fetchAppointments,
  };
}
