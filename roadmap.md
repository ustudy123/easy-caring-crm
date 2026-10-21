# Transferência de atendimento
# Busca de clientes ERP — Andinho
- [x] Diagnosticar busca por nome; corrigir espera excessiva e falso “cliente não encontrado”; seis testes passaram e consulta real SERC confirmou indisponibilidade do ERP (504).
- [ ] Confirmar resultados para SERC após o responsável pelo ERP restabelecer a conexão; ERP não responde atualmente.
- [ ] Validar busca e seleção pela tela na conta real; sessão de teste indisponível no Supabase externo.
# Ajustes do feedback de 21/10
- [x] Corrigir etapa em branco na edição do lead, incluindo Orçamento e Preço; dez testes validaram seleção e preservação ao salvar.
- [ ] Validar edição na conta real da equipe: acesso autenticado de teste indisponível no Supabase externo.
- [x] Usar confirmação própria para Conversa Interna.
- [x] Herdar o vendedor do card principal no Kanban e em Clientes; testes de gravação com vendedor diferente e sem vendedor passaram.
- [ ] Confirmar criação e leitura pela tela com conta real: sessão de teste indisponível no Supabase externo; depende de teste da equipe após publicação.

- [x] Corrigir bloqueio de transferência sem abrir acesso geral aos registros.
- [x] Unificar transferência de cliente, lead e histórico nas duas telas.
- [x] Validar Raquel → Andinho e rejeição de transferência por outro vendedor em teste reversível no banco; três testes da chamada passaram.
- [ ] Validar pela tela com a sessão da Raquel: acesso de teste indisponível no Supabase externo; depende do teste da usuária após publicação.