import { useEffect, useState } from "react";
import { loadCardTransfers, loadAdminWorkspaceBySlug, runCardTransfer, type AdminClientOption, type CardTransferOperation } from "./api";
import type { BoardCard, BoardColumn } from "./types";

export function CardTransferDialog({sourceSlug,card,clients,onClose,onSuccess}:{sourceSlug:string;card:BoardCard|null;clients:AdminClientOption[];onClose:()=>void;onSuccess:()=>void}) {
  const [operations,setOperations]=useState<CardTransferOperation[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [target,setTarget]=useState(clients[0]?.id??"");
  const [columns,setColumns]=useState<BoardColumn[]>([]);
  const [columnsReady,setColumnsReady]=useState(false);
  const [columnId,setColumnId]=useState("");
  const [mode,setMode]=useState<"copy"|"move">("copy");
  const [active,setActive]=useState<CardTransferOperation|null>(null);
  const reload=async()=>{const data=await loadCardTransfers(sourceSlug);setOperations(data.items);setActive(current=>current&&data.items.some(op=>op.operationKey===current.operationKey&&op.status!=="pending")?null:current);setLoaded(true);};
  useEffect(()=>{let alive=true;loadCardTransfers(sourceSlug).then(data=>{if(alive){setOperations(data.items);setLoaded(true);}}).catch(caught=>{if(alive)setError(caught instanceof Error?caught.message:"Não foi possível consultar as transferências.");});return()=>{alive=false;};},[sourceSlug]);
  const selectedTargetSlug=clients.find(client=>client.id===target)?.slug;
  useEffect(()=>{let alive=true;setColumns([]);setColumnsReady(false);setColumnId("");if(card&&selectedTargetSlug)loadAdminWorkspaceBySlug(selectedTargetSlug).then(data=>{if(alive){setColumns(data.columns);setColumnId(data.columns[0]?.id??"");setColumnsReady(true);}}).catch(()=>{if(alive)setError("Não foi possível carregar as colunas do destino.");});return()=>{alive=false;};},[selectedTargetSlug,card?.id]);
  const execute=async(op:CardTransferOperation)=>{
    if(saving)return;setSaving(true);setError("");setActive(op);
    try {await runCardTransfer(sourceSlug,op,"reserve");await runCardTransfer(sourceSlug,op,"execute");onSuccess();onClose();}
    catch(caught){setError(`${caught instanceof Error?caught.message:"Não foi possível confirmar a transferência."} Consulte ou retome a operação abaixo. A mesma operação não criará outro cartão.`);try{await reload();}catch{setLoaded(false);}}
    finally{setSaving(false);}
  };
  const relevant=operations.filter(op=>!card||op.sourceCardId===card.id);
  const uncertain=!!active || relevant.some(op=>op.status==="pending");
  return <div className="card-column-modal-backdrop" onMouseDown={()=>{if(!saving)onClose();}}><section className="card-column-modal card-client-dialog" role="dialog" aria-modal="true" style={{maxHeight:"88vh",overflowY:"auto"}} onMouseDown={event=>event.stopPropagation()}>
    <button className="card-column-modal-close" disabled={saving} onClick={onClose} aria-label="Fechar">×</button>
    <h3>{card?"Enviar card para outro cliente":"Transferências entre clientes"}</h3>
    {card?<><p>Copiar ou mover “{card.title}”. O histórico permite recuperar a mesma operação após recarregar ou entrar novamente.</p>
    <fieldset className="card-transfer-options" disabled={saving||uncertain}><legend>Ação</legend><label><input type="radio" checked={mode==="copy"} onChange={()=>setMode("copy")}/>Copiar (duplicar)</label><label><input type="radio" checked={mode==="move"} onChange={()=>setMode("move")}/>Mover (transferir)</label></fieldset>
    <label className="card-column-select-label">Cliente destino<select disabled={saving||uncertain} value={target} onChange={event=>setTarget(event.target.value)}>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <label className="card-column-select-label">Coluna destino<select disabled={saving||uncertain||!columnsReady} value={columnId} onChange={event=>setColumnId(event.target.value)}><option value="">Sem coluna</option>{columns.map(column=><option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
    </>:null}
    {error?<p role="alert" className="form-feedback error-text">{error}</p>:null}
    {!loaded?<p>Consultando histórico antes de permitir uma nova operação.</p>:null}
    {relevant.length?<div style={{maxHeight:"36vh",overflowY:"auto"}}><h4>Operações anteriores</h4>{relevant.map(op=><div key={op.operationKey} data-operation-key={op.operationKey}><p>{op.mode==="copy"?"Cópia":"Movimentação"} — {clients.find(client=>client.id===op.targetClientId)?.name??op.targetClientId}: {op.status==="completed"?"Concluída":op.status==="cancelled"?"Encerrada":"Pendente"}. {op.createdAt?new Date(op.createdAt).toLocaleString("pt-BR"):""}</p><details><summary>Detalhes da operação</summary><p>Referência: {op.operationKey}{op.destinationCardId?` · Cartão destino: ${op.destinationCardId}`:""}</p></details>{op.status==="pending"?<><button className="ghost-button" disabled={saving} onClick={()=>void execute(op)}>Retomar esta operação</button><button className="ghost-button" disabled={saving} onClick={()=>{setSaving(true);runCardTransfer(sourceSlug,op,"cancel").then(()=>{setActive(null);return reload();}).catch(caught=>setError(String(caught))).finally(()=>setSaving(false));}}>Encerrar tentativa pendente</button></>:null}</div>)}</div>:null}
    {active&&!operations.some(op=>op.operationKey===active.operationKey)?<button className="ghost-button" disabled={saving} onClick={()=>void execute(active)}>Retomar esta operação</button>:null}
    <div className="modal-actions"><button className="ghost-button" disabled={saving} onClick={onClose}>Fechar</button><button className="ghost-button" disabled={saving} onClick={()=>{setSaving(true);reload().then(()=>setError("")).catch(caught=>setError(String(caught))).finally(()=>setSaving(false));}}>Consultar resultado</button>
    {card?<button className="gradient-button" disabled={!loaded||saving||uncertain||!target||!columnsReady} onClick={()=>void execute({operationKey:crypto.randomUUID(),sourceCardId:card.id,sourceClientId:"",targetClientId:target,columnId:columnId||null,mode,status:"pending",destinationCardId:null})}>{saving?"Enviando...":mode==="copy"?"Copiar card":"Mover card"}</button>:null}</div>
  </section></div>;
}
