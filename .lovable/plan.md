## Multi-WhatsApp — central da loja + números próprios de vendedor

Suporte a múltiplos números conectados ao CRM, com 2 tipos de instância convivendo na mesma loja:
- **Central da loja** (`type=store`) — faz triagem (código → cidade → distribui)
- **Número próprio do vendedor** (`type=seller`) — vai direto para o vendedor, sem triagem

Regras confirmadas:
1. Vendedor com número próprio **continua no sorteio do central** (canal extra).
2. Mesmo cliente em 2 números = **threads separadas por número** na Central de Conversas.
3. Vendedor inativo com número próprio → **redireciona para substituto** (usa `enforce_substitute_when_inactive`).

---

### 1. Banco de dados (migração)

**Nova tabela `whatsapp_instances`:**
- `name`, `phone_number` (E.164 único), `instance_type` enum (`store` | `seller`)
- `store_id` (FK stores, obrigatório p/ store; opcional p/ seller herdar)
- `seller_id` (FK sellers, obrigatório p/ seller; null p/ store)
- `provider` enum (`uazapi` | `meta_cloud`), default `uazapi`
- `status` enum (`disconnected` | `qr_pending` | `connected` | `error`)
- `qr_code` text, `last_connected_at`, timestamps
- Constraint: `seller` requer `seller_id`; `store` requer `store_id` e `seller_id IS NULL`
- RLS: admin full; outros SELECT
- GRANTs: authenticated SELECT, service_role ALL

**Colunas novas:**
- `whatsapp_messages.received_on_instance_id` (FK whatsapp_instances, nullable)
- `clients.received_on_instance_id` (FK whatsapp_instances, nullable) — define por qual número responder

**Backfill:** criar 1 instância "default uazapi" e atribuir a mensagens/clientes existentes.

---

### 2. Webhook (`whatsapp-webhook`)

Refatorar para identificar a instância destinatária no payload e bifurcar:

```text
mensagem chega
  ↓
identifica instance (por phone_number/instance_id do payload)
  ↓
┌─ type=seller ─────────────────────┐    ┌─ type=store ──────────────────────┐
│ assigned_seller_id = inst.seller  │    │ fluxo atual: pede código →        │
│ store_id = seller.store           │    │ se vazio, pede cidade →           │
│ triaging = false                  │    │ sorteia entre vendedores da       │
│ stage = 'abordagem'               │    │ cidade (TODOS, inclusive os que   │
│ se inativo: substituto via        │    │ têm número próprio)               │
│ assign_client_with_redirection    │    │ store_id restrito ao inst.store   │
└───────────────────────────────────┘    └───────────────────────────────────┘
  ↓
salva received_on_instance_id em clients + whatsapp_messages
```

Cliente que já existe em outro número: **não unifica** — cria/atualiza registro tratando o par `(phone, received_on_instance_id)` como conversa distinta na Central. (No banco continua sendo 1 cliente por telefone, mas mensagens carregam o `received_on_instance_id` e a Central filtra por ele.)

---

### 3. Envio (`send-whatsapp`)

- Aceita `instance_id` opcional. Se ausente, lê `clients.received_on_instance_id`.
- Resolve credenciais por instância (segredos nomeados por instância ou config no banco — a definir na hora de conectar a 2ª instância real).
- Adapter pattern preparado: `uazapi` agora, `meta_cloud` depois.

---

### 4. UI Admin — aba "Números WhatsApp"

- Lista de instâncias com badge de tipo (`Loja` / `Vendedor`), status, último connect.
- Botão "Conectar novo número" → modal:
  - Tipo (Loja / Vendedor)
  - Loja (sempre) + Vendedor (se tipo=seller)
  - Provider (uazapi default)
  - Exibe QR Code; polling de status até `connected`
- Ações: desconectar, reconectar, excluir (apenas admin).
- Realtime via Supabase channel.

---

### 5. Central de Conversas

- Lista de conversas: agrupada por `(phone, received_on_instance_id)` → mesmo cliente em 2 números aparece 2x, cada uma com badge do número que recebeu.
- Filtro por instância no topo.
- Envio sempre pelo número que recebeu (passa `instance_id` no `send-whatsapp`).

---

### Detalhes técnicos

- `get_random_seller_by_city` permanece como está (já inclui todos os ativos — vendedores com número próprio entram no sorteio sem mudança).
- `enforce_substitute_when_inactive` já cobre o caso 3: quando o webhook de um número `type=seller` chega e o vendedor está inativo, chama `assign_client_with_redirection(phone, inst.seller_id)` e cai no substituto.
- `received_on_instance_id` em `clients` é atualizado a cada nova mensagem recebida → resposta sempre sai pelo último número que o cliente usou.
- Migração de dados: 1 instância default; mensagens antigas recebem `received_on_instance_id = default`.

---

### Fora de escopo desta fase

- SLA de 30min com auto-pass para próximo da fila (vai numa fase 2).
- Self-service de conexão por vendedor (só admin nesta fase).
- Billing/relatório por número.
- Provider Meta Cloud API funcional (estrutura preparada, mas integração real fica para depois).

---

### Ordem de execução após aprovação

1. Migração: tabela `whatsapp_instances` + colunas + backfill.
2. Refactor do webhook (bifurcação store/seller).
3. UI Admin (aba Números WhatsApp + modal QR).
4. `send-whatsapp` multi-instância.
5. Central de Conversas: threads por instância + filtro.
