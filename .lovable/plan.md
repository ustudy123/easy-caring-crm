## Exportação de Conversas com Controle por Cargo

Adicionar exportação de conversas WhatsApp na tela **Conversas**, com permissões diferenciadas por papel:

### Regras de acesso

- **Admin**: vê todas as conversas + pode **exportar** qualquer conversa
- **Gerente**: vê o histórico de todas as conversas da sua loja + não pode **exportar**
- **Vendedor / Suporte**: vê apenas suas próprias conversas, **não pode exportar** (botão oculto)

### Mudanças

**1. `src/pages/Conversas.tsx**`

- Importar `useRole` para obter papel atual (`isAdmin`, `isGerente`).
- Adicionar botão **"Exportar conversa"** (ícone `Download`) no header do chat selecionado, visível apenas se `isAdmin || isGerente`.
- Implementar função `handleExport()` que:
  - Gera um arquivo `.txt` formatado (data/hora · remetente · mensagem) da conversa atualmente aberta.
  - Nome do arquivo: `conversa-{telefone}-{YYYY-MM-DD}.txt`.
  - Usa `Blob` + `URL.createObjectURL` + `<a download>` para baixar no navegador (sem backend).
- Para gerentes: garantir que o filtro de listagem mostre todas as conversas da loja (já tratado por RLS — sem mudanças no banco).

**2. Filtro de visibilidade na listagem (frontend)**

- Vendedor/Suporte: filtrar conversas por telefones presentes em `leads`/`clients` atribuídos a ele (já filtrado pela RLS atual ao cruzar com leads do vendedor).
- Gerente/Admin: mostrar todas as conversas que a RLS retornar.

### Observações

- Nenhuma migração de banco necessária — RLS de `whatsapp_messages` já permite leitura para os papéis corretos.
- Exportação é 100% client-side (sem edge function), simples e instantânea.
- O botão de exportar terá `tooltip` explicando o que faz e estará desabilitado/oculto para perfis sem permissão (defesa em profundidade no UI; a segurança real está na RLS).