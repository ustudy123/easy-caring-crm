

## CRM Inteligente para Varejo de Tintas — Plano de Implementação

### Visão Geral
CRM web responsivo, colorido e vibrante, focado em gestão comercial para lojas de tintas. Interface intuitiva centrada no WhatsApp com Kanban visual, dashboards e gestão de clientes.

---

### Módulo 1: Estrutura Base e Autenticação
- Layout principal com sidebar colorida e navegação intuitiva
- Login/cadastro de usuários (vendedores e gerentes)
- Perfis de usuário com foto e informações básicas
- Banco de dados no Supabase (Lovable Cloud)

### Módulo 2: Kanban Comercial
- Funil visual com 5 etapas: **Novo Lead → Em Atendimento → Orçamento Enviado → Negociação → Fechado**
- Cards arrastáveis (drag & drop) com informações do cliente
- Cores distintas por etapa para fácil visualização
- Filtros por vendedor, data e status
- Contagem de cards e valor total por coluna

### Módulo 3: Gestão de Contatos/Clientes
- Cadastro completo de clientes (nome, telefone, e-mail, endereço)
- Histórico de interações e orçamentos por cliente
- Segmentação por tags (ex: "pintura residencial", "pintura comercial")
- Busca rápida e filtros avançados
- Página de perfil individual do cliente

### Módulo 4: Reagendamento e Agenda
- Calendário de follow-ups com data e hora específicos
- Lembretes automáticos para contato com cliente (ex: "Ligar dia 03/02 às 18h")
- Agenda diária e semanal do vendedor
- Histórico de tentativas de contato
- Sistema anti-perda: alerta quando lead está sem atendimento há muito tempo

### Módulo 5: Dashboard e Relatórios
- Visão geral com KPIs: leads novos, conversões, ticket médio, taxa de fechamento
- Gráficos de desempenho por vendedor
- Funil de conversão visual
- Relatório de leads perdidos vs. convertidos
- Filtros por período (dia, semana, mês)

### Módulo 6: Campanhas (rastreamento básico)
- Cadastro de campanhas com nome, canal (WhatsApp, Meta, Instagram) e UTM
- Vinculação de leads à campanha de origem
- Métricas por campanha: leads gerados, custo por lead, conversões

---

### Design Visual
- Paleta colorida e vibrante com cores fortes para cada etapa do Kanban
- Cards com bordas coloridas e ícones intuitivos
- Tipografia clara e legível
- Interface responsiva (desktop e mobile)
- Feedback visual com animações suaves

