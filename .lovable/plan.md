

## Integração CITEL — Fatia 1: Busca de cliente por telefone

Primeiro pedaço da integração com o ERP CITEL. Objetivo: ao cadastrar um novo cliente, o usuário digita o telefone, clica em "Buscar no ERP" e os campos (nome, email, endereço, cidade) são preenchidos automaticamente com os dados do ERP, se o cliente já existir lá.

### 1. Secrets no Supabase

Salvar três secrets usados apenas pela Edge Function (server-side, nunca expostos ao browser):

- `CITEL_API_URL` → `http://132.226.166.121:21158`
- `CITEL_USER` → `TESTE`
- `CITEL_PASSWORD` → `123`

Essas credenciais serão solicitadas via tool `add_secret` no início da implementação. O usuário confirma os valores em um prompt seguro.

### 2. Edge Function `citel-get-client`

Novo arquivo: `supabase/functions/citel-get-client/index.ts`

Responsabilidades:
- Recebe `POST { phone: string }`.
- Valida JWT do usuário chamador (reuso do padrão `getClaims`) — só usuários autenticados podem consultar o ERP.
- Normaliza o telefone (remove máscara, mantém só dígitos).
- Monta `Authorization: Basic base64(CITEL_USER:CITEL_PASSWORD)`.
- Chama o endpoint de clientes do CITEL filtrando por telefone. Como o Swagger ainda não foi explorado em detalhe, a função tentará o caminho mais provável (`/api/clientes?telefone={phone}`) e, em caso de 404, fará fallback para `/api/customers?phone={phone}`. Ambos os erros são logados para facilitar ajuste fino depois.
- Normaliza a resposta do ERP para um formato neutro que o frontend espera:
  ```json
  { "found": true, "client": { "name": "...", "email": "...", "address": "...", "city": "...", "erpId": "..." } }
  ```
  ou `{ "found": false }` quando nada é retornado.
- CORS headers em todas as respostas (inclusive erros), conforme padrão do projeto.
- Logs com `console.log`/`console.error` para inspeção no painel Supabase.

A função é registrada em `supabase/config.toml` com `verify_jwt = true` (padrão seguro, já que exigimos usuário logado).

### 3. UI — Botão "Buscar no ERP" no formulário de Novo Cliente

Arquivo afetado: `src/components/forms/NewClientForm.tsx`

Mudanças:
- Adicionar um botão ao lado do campo **Telefone**, com ícone `Search` e texto compacto "Buscar no ERP".
- Estado local `isSearching: boolean` para mostrar spinner durante a chamada.
- Ao clicar:
  1. Valida se o telefone tem formato válido (`isValidPhone`). Se não, mostra toast de erro e aborta.
  2. Chama `supabase.functions.invoke("citel-get-client", { body: { phone } })`.
  3. Em sucesso com `found: true`: preenche `name`, `email`, `address`, `city` do `form` (sem sobrescrever campos já digitados, a menos que o usuário confirme — regra: se o campo já tem valor, manter o valor do usuário). Toast de sucesso "Cliente encontrado no ERP".
  4. Em `found: false`: toast informativo "Cliente não encontrado no ERP — preencha manualmente".
  5. Em erro: toast destrutivo com mensagem genérica "Erro ao consultar ERP" e detalhe no console.
- Botão fica desabilitado se o telefone estiver vazio ou inválido.

### 4. O que NÃO entra nesta fatia

Para manter o escopo pequeno e validar a integração antes de expandir, ficam de fora:
- Coluna `erp_id` na tabela `clients` (entra na fatia 2, junto com reconciliação).
- Sincronização em massa / cron.
- Aba "Histórico ERP" na ficha do cliente.
- Botão equivalente no `EditClientForm`.
- Consulta de produtos/preços.

### Fluxo técnico resumido

```text
Usuário (NewClientForm)
    │  phone
    ▼
supabase.functions.invoke("citel-get-client")
    │  POST { phone }  +  JWT
    ▼
Edge Function (valida JWT, monta Basic Auth)
    │  GET /api/clientes?telefone=...
    ▼
CITEL ERP (HTTP + Basic Auth)
    │  { nome, email, endereco, cidade, ... }
    ▼
Edge Function normaliza → { found, client }
    │
    ▼
Form preenche campos vazios automaticamente
```

### Pontos de atenção

- **HTTP sem TLS**: o endpoint do CITEL é HTTP puro. A Edge Function consegue chamar, mas expomos isso no log para o cliente saber que deve migrar para HTTPS em produção.
- **Credenciais de homologação**: `TESTE/123` são temporárias. Quando o cliente fornecer credenciais reais, basta atualizar os secrets — nenhum código muda.
- **Resposta do ERP desconhecida**: como o Swagger não foi explorado em detalhe, o mapeamento dos campos (`nome` vs `name`, `endereco` vs `address`, etc.) será feito de forma defensiva, tentando ambas as variações. Após o primeiro teste real com resposta verdadeira, ajustamos.
- **Segurança**: apenas usuários autenticados chamam a função; as credenciais do ERP nunca saem do backend.

### Entregáveis

1. Três secrets CITEL configurados no Supabase.
2. `supabase/functions/citel-get-client/index.ts` deployado.
3. `NewClientForm.tsx` com botão "Buscar no ERP" funcional.
4. Entrada em `supabase/config.toml` para a nova função.

