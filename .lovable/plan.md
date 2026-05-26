## Multi-WhatsApp — finalizar visibilidade e casos especiais

A infra base (tabela `whatsapp_instances`, webhook bifurcado, envio multi-instância, aba Admin) já está implementada. Este plano cobre o que ainda falta para o sistema ficar igual ao desenhado nos screenshots: **visibilidade nos cards/conversas, casos especiais (transferência cross-instance, número desconectado) e UX da Central**.

---

### 1. Badge do número na UI (Kanban + Lista de Leads + Conversas)

- Trazer `received_on_instance_id` (+ join com `whatsapp_instances.name` e `instance_type`) nas queries de `clients` e `leads` no `CrmContext`.
- Componente novo `<InstanceBadge instance={...} />`:
  - Loja → ícone 🏬 + nome da instância (ex.: "Loja Tijuca")
  - Vendedor → ícone 📱 + nome (ex.: "João Direto")
  - Cor distinta por instância (hash do id → token do design system).
- Renderizar o badge em:
  - Card do Kanban (`Kanban.tsx`)
  - Linha da lista de Clientes (`Clientes.tsx`)
  - Cabeçalho da conversa na Central (`Conversas.tsx`)

### 2. Central de Conversas — filtro + thread por instância

- Filtro no topo: dropdown "Todos os números / Loja Tijuca / João Direto / …" populado de `whatsapp_instances`.
- Lista de conversas agrupa por `(phone, received_on_instance_id)`: mesmo cliente em 2 números aparece 2x, cada uma com seu badge.
- Ao abrir a conversa, busca mensagens filtradas pelo mesmo par.
- Envio: passar `instance_id` da conversa aberta para `send-whatsapp` (não confiar só no fallback do `clients.received_on_instance_id`).

### 3. Caso especial — cliente existente fala num número novo

No `whatsapp-webhook`, quando o cliente já existe mas o `received_on_instance_id` da mensagem é diferente do atual:
- Atualiza `clients.received_on_instance_id` para o novo.
- Se o **novo número é `type=seller`** e o `assigned_seller_id` atual é diferente do `instance.seller_id`:
  - Faz transferência: chama `assign_client_with_redirection(phone, instance.seller_id)`.
  - Registra em `redirection_history` com novo tipo `cross_instance` (motivo: "Cliente migrou para número direto de outro vendedor").
- Se o novo número é `type=store`: não força transferência (mantém vendedor), só atualiza `received_on_instance_id` e cria thread paralela na Central.

Migração leve: adicionar valor `'cross_instance'` no enum/coluna de `redirection_type` se for enum; se for text, só documentar.

### 4. Número desconectado — alerta no Admin

- Aba "Números WhatsApp" já mostra status. Adicionar:
  - Banner de alerta no topo da aba quando ≥1 instância está `disconnected` ou `error`.
  - Toast global (via realtime channel) para admins quando uma instância muda para `disconnected`.
- Mensagens recebidas em instância desconectada já não chegam (provedor não dispara) — não há mudança no webhook.

### 5. Vendedor com número próprio sai de férias

Já coberto por `enforce_substitute_when_inactive` + `assign_client_with_redirection` no webhook (passo 2 do plano original). Aqui só **garantir que o webhook `type=seller` use `assign_client_with_redirection`** em vez de update direto, para o substituto entrar automaticamente. Validar no código atual e ajustar se necessário.

### 6. Dashboard — KPIs por instância (fase leve)

- Adicionar filtro "Por número" no topo do Dashboard (mesmo dropdown da Central).
- Filtra KPIs existentes (volume de leads, tempo de resposta, conversão) por `received_on_instance_id`.
- Sem novos cards/gráficos nesta fase — só o filtro reaproveitando o que já existe.

---

### Detalhes técnicos

**Queries afetadas:**
- `CrmContext.tsx`: incluir `received_on_instance_id` + join `whatsapp_instances(name, instance_type)` em `clients` e `leads`.
- `Conversas.tsx`: agrupar por `(phone, received_on_instance_id)`; filtro adiciona `.eq('received_on_instance_id', filter)`.

**Webhook (`whatsapp-webhook/index.ts`):**
- Após identificar instância e cliente existente, comparar `client.received_on_instance_id` vs `instance.id`.
- Lógica de transferência só dispara para `type=seller` com `seller_id` diferente do atual.

**Componentes novos:**
- `src/components/InstanceBadge.tsx`
- `src/components/InstanceFilter.tsx` (dropdown reutilizado em Conversas e Dashboard)

**Sem mudança de schema** exceto opcional: valor `cross_instance` no enum de `redirection_type` (se existir como enum).

---

### Fora de escopo

- Conectar credenciais únicas por instância (continua usando env vars compartilhadas — fase quando 2ª instância real for plugada).
- KPIs novos quebrados por instância (gráficos dedicados).
- Self-service de conexão por vendedor.
- Provider Meta Cloud funcional.

---

### Ordem de execução

1. `InstanceBadge` + trazer dados nas queries do CrmContext.
2. Renderizar badge em Kanban, Clientes, Conversas.
3. `InstanceFilter` + filtro/agrupamento na Central de Conversas.
4. Lógica de transferência cross-instance no webhook + `redirection_history`.
5. Alerta de desconexão no Admin (banner + toast).
6. Filtro por instância no Dashboard.
