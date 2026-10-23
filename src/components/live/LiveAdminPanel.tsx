import { useEffect, useState } from "react";
import { Activity, Bot, Check, CircleAlert, Radio, Save, Send, Settings2, Swords, Trophy, X } from "lucide-react";

import { Badge } from "@/components/game-ui/badge";
import { Button } from "@/components/game-ui/button";
import type { CombatStats } from "@/game/types";
import { giftIcon, SPECIAL_MOVES } from "@/lib/live";
import type { DemoGiftCreate, GiftEvent, LiveConfig, LiveStatus, RoundResult, SpecialMove } from "@/lib/live";
import type { GiftDelivery } from "@/lib/gift-feed";

interface LiveAdminPanelProps {
  open: boolean;
  config: LiveConfig;
  status: LiveStatus;
  connectionText: string;
  stats: CombatStats;
  onCheckConnection: () => void;
  events: GiftEvent[];
  delivery: Record<string, GiftDelivery>;
  results: RoundResult[];
  saving: boolean;
  onClose: () => void;
  onSave: (config: LiveConfig) => void;
  onSimulate: (payload: DemoGiftCreate) => void;
  arena: ArenaControls;
  /** Optional desktop bridge status label (no extension panel). */
  desktopStatusText?: string;
}

export interface ArenaControls {
  inFight: boolean;
  paused: boolean;
  character: "lula" | "flavio";
  volume: number;
  onStart: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onCharacter: (id: "lula" | "flavio") => void;
  onAdjustHp: (id: "lula" | "flavio", delta: number) => void;
  onVolume: (value: number) => void;
}

/**
 * Admin da arena — somente configurações e simulação demo.
 * A antiga aba "PAINEL E EXTENSÃO" foi removida: eventos de live vêm do
 * serviço Node local (desktop) ou da simulação demo.
 */
export function LiveAdminPanel({
  open,
  config,
  status,
  connectionText,
  stats,
  onCheckConnection,
  events,
  delivery,
  results,
  saving,
  onClose,
  onSave,
  onSimulate,
  arena,
  desktopStatusText,
}: LiveAdminPanelProps) {
  const [draft, setDraft] = useState(config);
  const [giftId, setGiftId] = useState(config.rules[0]?.gift_id ?? "rose");
  const [username, setUsername] = useState("demo_viewer");
  const [quantity, setQuantity] = useState(1);
  const [beneficiary, setBeneficiary] = useState<"lula" | "flavio">("lula");

  useEffect(() => setDraft(config), [config]);
  if (!open) return null;

  const setCombat = <K extends keyof LiveConfig["combat"]>(key: K, value: LiveConfig["combat"][K]) =>
    setDraft((current) => ({ ...current, combat: { ...current.combat, [key]: value } }));

  const setRule = (id: string, patch: Partial<LiveConfig["rules"][number]>) =>
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.gift_id === id ? { ...rule, ...patch } : rule)),
    }));

  return (
    <div className="admin-backdrop" data-testid="live-admin-panel">
      <aside className="admin-panel">
        <div className="admin-header">
          <div>
            <Badge data-testid="admin-panel-badge">
              <Settings2 size={13} /> CONTROLE DA ARENA
            </Badge>
            <h2 data-testid="admin-panel-title">LIVE COMMAND</h2>
            <p data-testid="admin-panel-description">
              Configure presentes, regras de dano e o ritmo da transmissão. Eventos de live chegam pelo
              serviço desktop (Node) — a extensão Chrome antiga foi descontinuada.
            </p>
          </div>
          <button type="button" className="modal-close" data-testid="admin-panel-close-button" onClick={onClose}>
            <X />
          </button>
        </div>

        <section className="admin-status-card" data-testid="live-connection-card">
          <div className="admin-section-title">
            <Radio size={15} /> ESTADO DO LIVE
          </div>
          <strong data-testid="live-connection-state">{connectionText}</strong>
          <span data-testid="live-connection-message">{status.message}</span>
          {desktopStatusText ? (
            <small data-testid="desktop-bridge-status">{desktopStatusText}</small>
          ) : (
            <small data-testid="live-connection-policy">
              Conexão real não é simulada no navegador. No app desktop Windows, o serviço Node lê a fila
              Supabase e entrega os presentes ao jogo.
            </small>
          )}
          <button type="button" className="check-connection-button" data-testid="check-connection-button" onClick={onCheckConnection}>
            VERIFICAR CONEXÃO
          </button>
        </section>

        <section className="admin-section" data-testid="arena-controls-section">
          <div className="admin-section-title">
            <Activity size={15} /> CONTROLE DA RODADA
          </div>
          <div className="arena-controls">
            <button type="button" data-testid="admin-start-button" onClick={arena.onStart}>
              {arena.inFight ? "NOVA LUTA" : "INICIAR LUTA"}
            </button>
            <button type="button" data-testid="admin-pause-button" disabled={!arena.inFight} onClick={arena.onTogglePause}>
              {arena.paused ? "RETOMAR" : "PAUSAR"}
            </button>
            <button type="button" data-testid="admin-restart-button" onClick={arena.onRestart}>
              REINICIAR RODADA
            </button>
            <button type="button" data-testid="admin-fighter-lula-button" onClick={() => arena.onCharacter("lula")}>
              {arena.character === "lula" ? "● " : ""}P1 LULA
            </button>
            <button type="button" data-testid="admin-fighter-flavio-button" onClick={() => arena.onCharacter("flavio")}>
              {arena.character === "flavio" ? "● " : ""}P1 FLÁVIO
            </button>
          </div>
          <div className="arena-controls" style={{ marginTop: 7 }}>
            <button type="button" data-testid="admin-heal-lula-button" disabled={!arena.inFight} onClick={() => arena.onAdjustHp("lula", 50)}>
              LULA +50 HP
            </button>
            <button type="button" data-testid="admin-damage-lula-button" disabled={!arena.inFight} onClick={() => arena.onAdjustHp("lula", -50)}>
              LULA −50 HP
            </button>
            <button type="button" data-testid="admin-heal-flavio-button" disabled={!arena.inFight} onClick={() => arena.onAdjustHp("flavio", 50)}>
              FLÁVIO +50 HP
            </button>
            <button type="button" data-testid="admin-damage-flavio-button" disabled={!arena.inFight} onClick={() => arena.onAdjustHp("flavio", -50)}>
              FLÁVIO −50 HP
            </button>
          </div>
          <label className="admin-volume">
            VOLUME
            <input
              data-testid="admin-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={arena.volume}
              onChange={(event) => arena.onVolume(Number(event.target.value))}
            />
            <span data-testid="admin-volume-value">{Math.round(arena.volume * 100)}%</span>
          </label>
        </section>

        <section className="admin-section" data-testid="combat-settings-section">
          <div className="admin-section-title">
            <Swords size={15} /> COMBATE E INTELIGÊNCIA
          </div>
          <div className="admin-grid admin-grid-three">
            <label>
              INTEGRAÇÃO
              <select
                data-testid="live-mode-select"
                value={draft.integration_mode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    integration_mode: event.target.value as LiveConfig["integration_mode"],
                  }))
                }
              >
                <option value="demo">DEMO ONLY</option>
                <option value="live">LIVE / DESKTOP</option>
              </select>
            </label>
            <label>
              VIDA MÁXIMA
              <input data-testid="combat-max-hp-input" type="number" value={draft.combat.max_hp} onChange={(e) => setCombat("max_hp", Number(e.target.value))} />
            </label>
            <label>
              MODO DE DANO
              <select data-testid="combat-mode-select" value={draft.combat.combat_mode} onChange={(e) => setCombat("combat_mode", e.target.value as LiveConfig["combat"]["combat_mode"])}>
                <option value="live">LIVE INTERATIVO</option>
                <option value="normal">COMBATE NORMAL</option>
              </select>
            </label>
            <label>
              DURAÇÃO (S)
              <input data-testid="combat-duration-input" type="number" value={draft.combat.fight_duration_sec} onChange={(e) => setCombat("fight_duration_sec", Number(e.target.value))} />
            </label>
            <label>
              FREQ. CPU
              <input data-testid="combat-frequency-input" type="number" step="0.1" value={draft.combat.auto_attack_frequency} onChange={(e) => setCombat("auto_attack_frequency", Number(e.target.value))} />
            </label>
            <label>
              DEFESA
              <input data-testid="combat-defense-input" type="number" step="0.05" value={draft.combat.defense_reduction} onChange={(e) => setCombat("defense_reduction", Number(e.target.value))} />
            </label>
            <label>
              META DE PRESENTES
              <input data-testid="collective-goal-input" type="number" value={draft.combat.collective_goal} onChange={(e) => setCombat("collective_goal", Number(e.target.value))} />
            </label>
            <label>
              DANO COMUM
              <input data-testid="combat-common-damage-input" type="number" value={draft.combat.common_damage} onChange={(e) => setCombat("common_damage", Number(e.target.value))} />
            </label>
            <label>
              DANO COMBO
              <input data-testid="combat-combo-damage-input" type="number" value={draft.combat.combo_damage} onChange={(e) => setCombat("combo_damage", Number(e.target.value))} />
            </label>
            <label>
              RECUPERAÇÃO MS
              <input data-testid="combat-recovery-input" type="number" value={draft.combat.recovery_ms} onChange={(e) => setCombat("recovery_ms", Number(e.target.value))} />
            </label>
            <label>
              INVULNERÁVEL MS
              <input data-testid="combat-invulnerability-input" type="number" value={draft.combat.invulnerability_ms} onChange={(e) => setCombat("invulnerability_ms", Number(e.target.value))} />
            </label>
            <label>
              EFEITOS VISUAIS
              <input data-testid="combat-visual-input" type="number" step="0.1" value={draft.combat.visual_intensity} onChange={(e) => setCombat("visual_intensity", Number(e.target.value))} />
            </label>
            <label>
              FINALIZAÇÃO
              <select data-testid="combat-finisher-select" value={draft.combat.allow_finisher ? "on" : "off"} onChange={(e) => setCombat("allow_finisher", e.target.value === "on")}>
                <option value="off">DESATIVADA</option>
                <option value="on">HABILITADA</option>
              </select>
            </label>
            <label>
              VELOCIDADE
              <input data-testid="animation-speed-input" type="number" step="0.1" value={draft.combat.animation_speed} onChange={(e) => setCombat("animation_speed", Number(e.target.value))} />
            </label>
            <label>
              ATORDOAMENTO MS
              <input data-testid="combat-stun-input" type="number" value={draft.combat.stun_ms} onChange={(e) => setCombat("stun_ms", Number(e.target.value))} />
            </label>
            <label>
              LEGENDA MS
              <input data-testid="combat-caption-input" type="number" value={draft.combat.caption_ms} onChange={(e) => setCombat("caption_ms", Number(e.target.value))} />
            </label>
            <label>
              ZOOM CÂMERA
              <input data-testid="combat-camera-zoom-input" type="number" step="0.1" value={draft.combat.camera_zoom} onChange={(e) => setCombat("camera_zoom", Number(e.target.value))} />
            </label>
            <label>
              IA (0-1)
              <input data-testid="combat-ai-skill-input" type="number" step="0.05" value={draft.combat.ai_skill} onChange={(e) => setCombat("ai_skill", Number(e.target.value))} />
            </label>
            <label>
              EFEITOS
              <select data-testid="combat-effects-select" value={draft.combat.effects_enabled ? "on" : "off"} onChange={(e) => setCombat("effects_enabled", e.target.value === "on")}>
                <option value="on">COMPLETOS</option>
                <option value="off">REDUZIDOS</option>
              </select>
            </label>
            <label>
              CÂMERA LENTA
              <select data-testid="combat-slowmo-select" value={draft.combat.slow_motion ? "on" : "off"} onChange={(e) => setCombat("slow_motion", e.target.value === "on")}>
                <option value="on">LIGADA</option>
                <option value="off">DESLIGADA</option>
              </select>
            </label>
            <label>
              FILA
              <select data-testid="combat-queue-priority-select" value={draft.combat.queue_priority} onChange={(e) => setCombat("queue_priority", e.target.value as LiveConfig["combat"]["queue_priority"])}>
                <option value="fifo">ORDEM DE CHEGADA</option>
                <option value="impact">PRIORIZAR GRANDES</option>
              </select>
            </label>
            <label>
              FUNDO
              <select data-testid="backdrop-select" value={draft.combat.backdrop} onChange={(e) => setCombat("backdrop", e.target.value as LiveConfig["combat"]["backdrop"])}>
                <option value="brasilia">BRASÍLIA PIXEL</option>
                <option value="neon">NEON ARENA</option>
              </select>
            </label>
          </div>
        </section>

        <section className="admin-section" data-testid="gift-rules-section">
          <div className="admin-section-title">
            <Swords size={15} /> MAPA DE PRESENTES <small data-testid="gift-rules-count">{draft.rules.length} associações</small>
          </div>
          <div className="rules-list">
            {draft.rules.length === 0 && (
              <span className="admin-persistence-note" data-testid="gift-rules-empty">
                Nenhum presente configurado.
              </span>
            )}
            {draft.rules.map((rule) => (
              <div className={`rule-row ${rule.enabled ? "" : "is-disabled"}`} key={rule.gift_id} data-testid={`gift-rule-${rule.gift_id}`}>
                <div className="rule-title">
                  <input type="checkbox" data-testid={`gift-rule-${rule.gift_id}-enabled`} checked={rule.enabled} onChange={(e) => setRule(rule.gift_id, { enabled: e.target.checked })} />
                  <strong data-testid={`gift-rule-${rule.gift_id}-label`}>
                    {giftIcon(rule.gift_id)} {rule.gift_name}
                  </strong>
                  <small>
                    {rule.gift_id} // {rule.reference_value.toLocaleString("pt-BR")} moedas
                  </small>
                </div>
                <div className="rule-fields">
                  <label>
                    PRESENTE
                    <input data-testid={`gift-rule-${rule.gift_id}-name`} value={rule.gift_name} onChange={(e) => setRule(rule.gift_id, { gift_name: e.target.value })} />
                  </label>
                  <label>
                    GOLPE
                    <input data-testid={`gift-rule-${rule.gift_id}-action`} value={rule.action_name} onChange={(e) => setRule(rule.gift_id, { action_name: e.target.value })} />
                  </label>
                  <label>
                    DANO
                    <input data-testid={`gift-rule-${rule.gift_id}-damage`} type="number" value={rule.damage} onChange={(e) => setRule(rule.gift_id, { damage: Number(e.target.value) })} />
                  </label>
                  <label>
                    EFEITO
                    <input data-testid={`gift-rule-${rule.gift_id}-intensity`} type="number" step="0.1" value={rule.effect_intensity} onChange={(e) => setRule(rule.gift_id, { effect_intensity: Number(e.target.value) })} />
                  </label>
                  <label>
                    ESPECIAL
                    <select data-testid={`gift-rule-${rule.gift_id}-special`} value={rule.special_move} onChange={(e) => setRule(rule.gift_id, { special_move: e.target.value as SpecialMove })}>
                      {SPECIAL_MOVES.map((move) => (
                        <option key={move.id} value={move.id}>
                          {move.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ID CONECTOR
                    <input data-testid={`gift-rule-${rule.gift_id}-gift-id`} value={rule.gift_id} disabled />
                  </label>
                  <label>
                    ANIMAÇÃO MS
                    <input data-testid={`gift-rule-${rule.gift_id}-duration`} type="number" value={rule.animation_ms} onChange={(e) => setRule(rule.gift_id, { animation_ms: Number(e.target.value) })} />
                  </label>
                  <label>
                    ALVO
                    <select data-testid={`gift-rule-${rule.gift_id}-target`} value={rule.target_character} onChange={(e) => setRule(rule.gift_id, { target_character: e.target.value as LiveConfig["rules"][number]["target_character"] })}>
                      <option value="opponent">ADVERSÁRIO</option>
                      <option value="lula">LULA</option>
                      <option value="flavio">FLÁVIO</option>
                    </select>
                  </label>
                  <label>
                    REPETIÇÃO
                    <select data-testid={`gift-rule-${rule.gift_id}-repeat`} value={rule.repeat_policy} onChange={(e) => setRule(rule.gift_id, { repeat_policy: e.target.value as LiveConfig["rules"][number]["repeat_policy"] })}>
                      <option value="individual">INDIVIDUAL</option>
                      <option value="group">AGRUPAR</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section simulate-section" data-testid="simulate-gift-section">
          <div className="admin-section-title">
            <Send size={15} /> SIMULAR PRESENTE <Badge data-testid="demo-only-badge">DEMO ONLY</Badge>
          </div>
          <div className="simulate-grid">
            <label>
              PRESENTE
              <select data-testid="simulate-gift-select" value={giftId} onChange={(e) => setGiftId(e.target.value)}>
                {draft.rules.map((rule) => (
                  <option key={rule.gift_id} value={rule.gift_id} label={`${rule.gift_name} — ${rule.action_name}`} />
                ))}
              </select>
            </label>
            <label>
              USUÁRIO
              <input data-testid="simulate-user-input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label>
              QTD
              <input data-testid="simulate-quantity-input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
            </label>
            <label>
              BENEFICIADO
              <select data-testid="simulate-beneficiary-select" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value as "lula" | "flavio")}>
                <option value="lula">LULA</option>
                <option value="flavio">FLÁVIO</option>
              </select>
            </label>
          </div>
          <div className="quick-gifts" data-testid="quick-gift-buttons">
            {draft.rules
              .filter((rule) => rule.enabled)
              .map((rule) => (
                <button
                  type="button"
                  key={rule.gift_id}
                  data-testid={`quick-gift-${rule.gift_id}-button`}
                  onClick={() =>
                    onSimulate({
                      gift_id: rule.gift_id,
                      username: username.trim() || "demo_viewer",
                      quantity: 1,
                      benefited_character: beneficiary,
                    })
                  }
                >
                  <span>
                    {giftIcon(rule.gift_id)} {rule.gift_name}
                  </span>
                  <small data-testid={`quick-gift-${rule.gift_id}-caption`}>{rule.action_name}</small>
                </button>
              ))}
          </div>
          <Button
            type="button"
            data-testid="simulate-gift-button"
            disabled={!draft.rules.some((rule) => rule.gift_id === giftId)}
            onClick={() =>
              onSimulate({
                gift_id: giftId,
                username: username.trim() || "demo_viewer",
                quantity,
                benefited_character: beneficiary,
              })
            }
          >
            <Send size={15} /> ENFILEIRAR PRESENTE
          </Button>
        </section>

        <div className="admin-actions">
          <Button type="button" data-testid="save-live-config-button" disabled={saving} onClick={() => onSave(draft)}>
            <Save size={15} /> {saving ? "SALVANDO…" : "SALVAR CONFIGURAÇÃO"}
          </Button>
          <span className="admin-persistence-note" data-testid="admin-persistence-note">
            <Check size={13} /> Persistência no backend
          </span>
        </div>

        <section className="admin-section admin-events-grid">
          <div>
            <div className="admin-section-title">
              <CircleAlert size={15} /> PRESENTES RECENTES
            </div>
            <div className="admin-event-list" data-testid="gift-history-list">
              {events.slice(0, 6).map((event) => (
                <span key={event.event_id} data-testid={`history-event-${event.sequence}`}>
                  #{event.sequence} @{event.username} · {event.gift_name}
                  {delivery[event.event_id] ? ` (${delivery[event.event_id]})` : ""}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="admin-section-title">
              <Trophy size={15} /> VITÓRIAS E DERROTAS
            </div>
            <div className="admin-event-list" data-testid="round-results-list">
              {results.length === 0 ? (
                <span data-testid="round-results-empty">Nenhuma rodada concluída.</span>
              ) : (
                results.slice(0, 10).map((result) => (
                  <span key={result.id} data-testid={`round-result-${result.id}`}>
                    R{result.round} · {result.winner.toUpperCase()} venceu {result.loser.toUpperCase()} · {result.gifts_count} presentes
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="admin-section" data-testid="combat-stats-section">
          <div className="admin-section-title">
            <Activity size={15} /> ESTATÍSTICAS DA LUTA
          </div>
          <div className="combat-stats">
            {(
              Object.entries({
                "Socos retos": stats.jab,
                "Socos fortes": stats.hook,
                Uppercuts: stats.uppercut,
                Chutes: stats.kick,
                Rasteiras: stats.sweep,
                Voadoras: stats.airkick,
                Agarrões: stats.grab,
                Hadoukens: stats.hadouken,
                Shoryukens: stats.shoryuken,
                Ultras: stats.ultra_hadouken,
                "Invocações do Xande": stats.invocadores,
                Genkidamas: stats.genkidama,
                Fatalities: stats.fatalities,
                Domínios: stats.domains,
                Projeções: stats.throws,
                Quedas: stats.knockdowns,
                Combos: stats.combos,
                Atordoamentos: stats.stuns,
                Bloqueios: stats.blocks,
                Esquivas: stats.dodges,
                "Contra-ataques": stats.counters,
              }) as [string, number][]
            ).map(([label, value]) => (
              <span key={label} data-testid={`stat-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                <b>{value}</b> {label}
              </span>
            ))}
          </div>
        </section>

        <div className="admin-footer">
          <Bot size={14} />
          <span data-testid="provider-requirement-note">
            LIVE real: app desktop Windows + serviço Node local + Supabase (live_game_events). Este painel não usa mais extensão de navegador.
          </span>
        </div>
      </aside>
    </div>
  );
}
