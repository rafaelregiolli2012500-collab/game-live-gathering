import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Gift, Hash, Play, Plug, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { clearViewerTeams, getExtensionPanel, updateExtensionSettings, type ExtensionPanelData } from "@/lib/extension.functions";
import { Button } from "@/components/game-ui/button";
import { giftEffectLabel, giftIcon } from "@/lib/live";
import type { GiftDelivery } from "@/lib/gift-feed";

const ZIP = "/brasil-fight-conector.zip";

function download() {
  fetch(ZIP)
    .then((res) => { if (!res.ok) throw new Error(`Falha no download (${res.status})`); return res.blob(); })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "brasil-fight-conector.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((err: Error) => toast.error(err.message));
}

const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));

function lastSeen(at: string | null) {
  if (!at) return { on: false, text: "Extensão ainda não conectou" };
  const sec = Math.round((Date.now() - new Date(at).getTime()) / 1000);
  return { on: sec < 120, text: sec < 120 ? `Extensão ativa (há ${sec}s)` : `Último sinal há ${Math.round(sec / 60)} min` };
}

export function ExtensionPanel({ delivery, inFight, onStart }: { delivery: Record<string, GiftDelivery>; inFight: boolean; onStart: () => void }) {
  const qc = useQueryClient();
  const panel = useQuery({ queryKey: ["extension-panel"], queryFn: () => getExtensionPanel(), refetchInterval: 4000 });
  const [form, setForm] = useState<Pick<ExtensionPanelData, "keyword_lula" | "keyword_flavio" | "default_character"> | null>(null);
  useEffect(() => { if (panel.data && !form) setForm({ keyword_lula: panel.data.keyword_lula, keyword_flavio: panel.data.keyword_flavio, default_character: panel.data.default_character }); }, [panel.data, form]);

  const save = useMutation({
    mutationFn: (regenerate_token: boolean) => {
      if (!form) throw new Error("Aguarde as configurações");
      return updateExtensionSettings({ data: { ...form, regenerate_token } });
    },
    onSuccess: (_r, regen) => { toast.success(regen ? "Novo código gerado — atualize na extensão" : "Palavras-chave salvas"); qc.invalidateQueries({ queryKey: ["extension-panel"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });
  const clear = useMutation({ mutationFn: () => clearViewerTeams(), onSuccess: () => qc.invalidateQueries({ queryKey: ["extension-panel"] }) });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const data = panel.data;
  const seen = lastSeen(data?.last_seen_at ?? null);

  return (
    <>
      <section className="admin-status-card" data-testid="extension-status-card">
        <div className="admin-section-title"><Plug size={15} /> CONECTOR DA LIVE</div>
        <strong>{seen.on ? "● " : "○ "}{seen.text}</strong>
        <span>A extensão lê a página da sua live, captura quem enviou cada presente e a quantidade, e manda para a arena. O personagem de cada pessoa é definido pela palavra-chave que ela escreve no chat.</span>
        <button type="button" className="check-connection-button" data-testid="download-extension-button" onClick={download}><Download size={13} /> BAIXAR EXTENSÃO</button>
      </section>

      <section className="admin-section" data-testid="extension-pairing-section">
        <div className="admin-section-title"><Plug size={15} /> CONECTAR AO PAINEL</div>
        <div className="admin-grid">
          <label>ENDEREÇO DO JOGO<div className="ext-copy"><input readOnly value={origin} /><button type="button" onClick={() => copy(origin)}><Copy size={13} /></button></div></label>
          <label>CÓDIGO DE CONEXÃO<div className="ext-copy"><input readOnly value={data?.token ?? "…"} data-testid="extension-token" /><button type="button" onClick={() => data && copy(data.token)}><Copy size={13} /></button></div></label>
        </div>
        <div className="arena-controls" style={{ marginTop: 8 }}><button type="button" disabled={!form || save.isPending} onClick={() => save.mutate(true)}><RefreshCw size={12} /> GERAR NOVO CÓDIGO</button></div>
        <ol className="ext-steps">
          <li>Baixe e descompacte o arquivo.</li>
          <li>No Chrome, abra <b>chrome://extensions</b> e ative o <b>Modo do desenvolvedor</b>.</li>
          <li>Clique em <b>Carregar sem compactação</b> e escolha a pasta descompactada.</li>
          <li>Abra a página da sua live (recarregue com F5 depois de instalar), clique no ícone da extensão, cole o endereço e o código e clique em <b>Conectar ao painel</b>.</li>
          <li>Pronto: a <b>leitura automática</b> já procura #lula, #flavio e os nomes dos presentes em toda a página. Tudo que for reconhecido aparece em <b>Atividade</b>.</li>
          <li>Se nada aparecer, ligue <b>Leitura por imagem (OCR)</b> e escolha a área do chat com 1 clique. A aba da live precisa ficar visível na tela.</li>
        </ol>
      </section>

      <section className="admin-section" data-testid="keyword-section">
        <div className="admin-section-title"><Hash size={15} /> DETECTOR DE PALAVRA-CHAVE</div>
        {form && (
          <div className="admin-grid admin-grid-three">
            <label>TIME LULA<input data-testid="keyword-lula-input" value={form.keyword_lula} onChange={(e) => setForm({ ...form, keyword_lula: e.target.value })} /></label>
            <label>TIME FLÁVIO<input data-testid="keyword-flavio-input" value={form.keyword_flavio} onChange={(e) => setForm({ ...form, keyword_flavio: e.target.value })} /></label>
            <label>SEM PALAVRA-CHAVE<select data-testid="default-character-select" value={form.default_character} onChange={(e) => setForm({ ...form, default_character: e.target.value as ExtensionPanelData["default_character"] })}><option value="none">IGNORAR PRESENTE</option><option value="lula">VAI PARA LULA</option><option value="flavio">VAI PARA FLÁVIO</option></select></label>
          </div>
        )}
        <div className="arena-controls" style={{ marginTop: 8 }}><button type="button" data-testid="save-keywords-button" disabled={!form || save.isPending} onClick={() => save.mutate(false)}>SALVAR PALAVRAS-CHAVE</button><button type="button" onClick={() => clear.mutate()}><Trash2 size={12} /> ZERAR TIMES</button></div>
        <small className="admin-persistence-note">Quem comentar {form?.keyword_lula ?? "#lula"} ou {form?.keyword_flavio ?? "#flavio"} entra naquele time; os presentes dessa pessoa disparam o especial a favor do personagem escolhido. A última palavra enviada vale.</small>
      </section>

      <section className="admin-section" data-testid="extension-gifts-section">
        <div className="admin-section-title"><Gift size={15} /> PRESENTES DA LIVE <small>{data?.gifts.length ?? 0}</small></div>
        {!inFight && <Button variant="outline" onClick={onStart} data-testid="extension-start-fight"><Play size={13} /> INICIAR LUTA</Button>}
        {panel.isError && <p className="text-destructive">Não foi possível atualizar os presentes.</p>}
        <div className="admin-event-list">
          {!data?.gifts.length ? <span>Nenhum presente reconhecido ainda.</span> : data.gifts.map((event) => (
            <div key={event.event_id} data-testid={`extension-gift-${event.sequence}`} className="grid gap-1 border-b border-border py-3 text-foreground">
              <strong className="break-words">@{event.username} · {giftIcon(event.gift_id)} {event.gift_name} ×{event.quantity}</strong>
              <small className="text-muted-foreground">{event.benefited_character === "lula" ? "LULA" : "FLÁVIO"} · {giftEffectLabel(event)}</small>
              <small className="text-muted-foreground">{delivery[event.event_id] === "completed" ? "Aplicado na luta" : delivery[event.event_id] === "processing" ? "Em execução na luta" : delivery[event.event_id] === "queued" ? "Na fila da luta" : "Registrado no painel"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section" data-testid="viewer-teams-section">
        <div className="admin-section-title"><Hash size={15} /> TIMES DA PLATEIA <small>{data?.teams.length ?? 0}</small></div>
        <div className="admin-event-list">
          {!data?.teams.length ? <span>Ninguém escolheu personagem ainda.</span> : data.teams.map((t) => <span key={t.username}>@{t.username} → <b>{t.character === "lula" ? "LULA" : "FLÁVIO"}</b></span>)}
        </div>
      </section>
    </>
  );
}
