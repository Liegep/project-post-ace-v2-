import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KanbanScrollWrapper } from "@/components/KanbanScrollWrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, ArrowLeft, Trash2, MoreVertical, Pencil, FileText, CheckCircle2, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import UserProfileMenu from "@/components/UserProfileMenu";
import { MobileNav } from "@/components/MobileNav";
import { CreateBriefFromIdeaDialog } from "@/components/CreateBriefFromIdeaDialog";

interface IdeaColumn {
  id: string;
  name: string;
  position: number;
  user_id: string;
}

interface Idea {
  id: string;
  column_id: string;
  user_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  converted_to_brief: boolean;
  converted_at: string | null;
  converted_brief_id: string | null;
}

type StatusFilter = "all" | "available" | "converted";

const IdeasPage = () => {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<IdeaColumn[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // New column
  const [newColName, setNewColName] = useState("");
  const [addingCol, setAddingCol] = useState(false);

  // New idea
  const [addingIdeaCol, setAddingIdeaCol] = useState<string | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDesc, setIdeaDesc] = useState("");

  // Edit idea
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Edit column
  const [editingCol, setEditingCol] = useState<IdeaColumn | null>(null);
  const [editColName, setEditColName] = useState("");

  // Convert to brief
  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [colRes, ideaRes] = await Promise.all([
      supabase.from("idea_columns").select("*").order("position"),
      supabase.from("ideas").select("*").order("position"),
    ]);

    setColumns((colRes.data as IdeaColumn[]) || []);
    setIdeas((ideaRes.data as Idea[]) || []);
    setLoading(false);
  };

  const filteredIdeas = useMemo(() => {
    if (statusFilter === "all") return ideas;
    if (statusFilter === "converted") return ideas.filter(i => i.converted_to_brief);
    return ideas.filter(i => !i.converted_to_brief);
  }, [ideas, statusFilter]);

  const convertedCount = useMemo(() => ideas.filter(i => i.converted_to_brief).length, [ideas]);
  const availableCount = useMemo(() => ideas.filter(i => !i.converted_to_brief).length, [ideas]);

  const handleBriefCreated = async (briefId: string) => {
    if (!convertingIdea) return;
    // Mark idea as converted
    await supabase.from("ideas").update({
      converted_to_brief: true,
      converted_at: new Date().toISOString(),
      converted_brief_id: briefId,
    } as any).eq("id", convertingIdea.id);

    setConvertingIdea(null);
    fetchAll();
  };

  const addColumn = async () => {
    if (!newColName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("idea_columns").insert({
      name: newColName.trim(),
      user_id: user.id,
      position: columns.length,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewColName("");
      setAddingCol(false);
      fetchAll();
    }
  };

  const deleteColumn = async (colId: string) => {
    const { error } = await supabase.from("idea_columns").delete().eq("id", colId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchAll();
    }
  };

  const updateColumn = async () => {
    if (!editingCol || !editColName.trim()) return;
    const { error } = await supabase.from("idea_columns").update({ name: editColName.trim() }).eq("id", editingCol.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setEditingCol(null);
      fetchAll();
    }
  };

  const addIdea = async () => {
    if (!ideaTitle.trim() || !addingIdeaCol) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const colIdeas = ideas.filter(i => i.column_id === addingIdeaCol);

    const { error } = await supabase.from("ideas").insert({
      column_id: addingIdeaCol,
      user_id: user.id,
      title: ideaTitle.trim(),
      description: ideaDesc.trim(),
      position: colIdeas.length,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setIdeaTitle("");
      setIdeaDesc("");
      setAddingIdeaCol(null);
      fetchAll();
    }
  };

  const deleteIdea = async (ideaId: string) => {
    const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      fetchAll();
    }
  };

  const updateIdea = async () => {
    if (!editingIdea || !editTitle.trim()) return;
    const { error } = await supabase.from("ideas").update({
      title: editTitle.trim(),
      description: editDesc.trim(),
    }).eq("id", editingIdea.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setEditingIdea(null);
      fetchAll();
    }
  };

  const moveIdea = async (idea: Idea, targetColId: string) => {
    const targetIdeas = ideas.filter(i => i.column_id === targetColId);
    const { error } = await supabase.from("ideas").update({
      column_id: targetColId,
      position: targetIdeas.length,
    }).eq("id", idea.id);

    if (!error) fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <MobileNav title="Ideias" />
          <Button variant="ghost" size="icon" className="hidden md:inline-flex group bg-white hover:bg-foreground shadow-md border border-border/40 transition-colors" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5 text-black group-hover:text-white transition-colors" strokeWidth={2.5} />
          </Button>
          <h1 className="type-heading truncate text-foreground">💡 Ideias de Pauta</h1>
        </div>
        <div className="flex items-center gap-2 text-primary-foreground">
          {/* Add column button in header */}
          <Popover open={addingCol} onOpenChange={setAddingCol}>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-primary-foreground h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Nova coluna
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-2">
                <Input
                  placeholder="Nome da coluna"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addColumn()}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addColumn}>Criar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingCol(false)}>Cancelar</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* Status filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ({ideas.length})</SelectItem>
                <SelectItem value="available">Disponíveis ({availableCount})</SelectItem>
                <SelectItem value="converted">Convertidas ({convertedCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <UserProfileMenu />
        </div>
      </header>

      {/* Board */}
      <KanbanScrollWrapper className="p-4 md:p-6 min-h-[calc(100vh-73px)]">
        {columns.map((col) => {
          const colIdeas = filteredIdeas
            .filter(i => i.column_id === col.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div key={col.id} className="flex-shrink-0 w-72 md:w-80">
              <div className="bg-muted rounded-lg p-3">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm">{col.name}</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {colIdeas.length}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingCol(col); setEditColName(col.name); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn(col.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Ideas */}
                <div className="mb-ui-3 space-y-ui-2">
                  {colIdeas.map((idea) => (
                    <Card
                      key={idea.id}
                      className={`hover:shadow-md transition-shadow ${idea.converted_to_brief ? "border-primary/20 bg-primary/5" : ""}`}
                    >
                      <CardContent className="flex h-full flex-col p-ui-3">
                        <div className="flex items-start justify-between gap-ui-2">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => { setEditingIdea(idea); setEditTitle(idea.title); setEditDesc(idea.description); }}
                          >
                            <p className="font-medium text-sm text-foreground truncate">{idea.title}</p>
                            {idea.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                            )}
                            {idea.converted_to_brief && (
                              <div className="mt-ui-2 flex items-center gap-ui-1">
                                <CheckCircle2 className="size-icon-xs text-primary" />
                                <span className="text-ui-xs font-medium text-primary">
                                  Transformada em pauta
                                </span>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreVertical className="size-icon-xs" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingIdea(idea); setEditTitle(idea.title); setEditDesc(idea.description); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {columns.filter(c => c.id !== col.id).map(targetCol => (
                                <DropdownMenuItem key={targetCol.id} onClick={() => moveIdea(idea, targetCol.id)}>
                                  Mover para {targetCol.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteIdea(idea.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Criar Pauta button — always visible */}
                        <Button
                          variant={idea.converted_to_brief ? "outline" : "secondary"}
                          size="sm"
                          className="mt-ui-2 w-full gap-ui-2 text-ui-xs"
                          onClick={() => setConvertingIdea(idea)}
                        >
                          <FileText className="size-icon-xs" />
                          {idea.converted_to_brief ? "Criar pauta novamente" : "Criar pauta"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Add idea button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => { setAddingIdeaCol(col.id); setIdeaTitle(""); setIdeaDesc(""); }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar ideia
                </Button>
              </div>
            </div>
          );
        })}

      </KanbanScrollWrapper>

      {/* Add idea dialog */}
      <Dialog open={!!addingIdeaCol} onOpenChange={() => setAddingIdeaCol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ideia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título da ideia"
              value={ideaTitle}
              onChange={(e) => setIdeaTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={ideaDesc}
              onChange={(e) => setIdeaDesc(e.target.value)}
              rows={3}
            />
            <Button onClick={addIdea} disabled={!ideaTitle.trim()} className="w-full">
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit idea dialog */}
      <Dialog open={!!editingIdea} onOpenChange={() => setEditingIdea(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ideia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descrição"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
            />
            <Button onClick={updateIdea} disabled={!editTitle.trim()} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit column dialog */}
      <Dialog open={!!editingCol} onOpenChange={() => setEditingCol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && updateColumn()}
            />
            <Button onClick={updateColumn} disabled={!editColName.trim()} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to brief dialog */}
      {convertingIdea && (
        <CreateBriefFromIdeaDialog
          open={!!convertingIdea}
          onOpenChange={(open) => { if (!open) setConvertingIdea(null); }}
          title={convertingIdea.title}
          description={convertingIdea.description}
          alreadyConverted={convertingIdea.converted_to_brief}
          onCreated={handleBriefCreated}
        />
      )}
    </div>
  );
};

export default IdeasPage;
