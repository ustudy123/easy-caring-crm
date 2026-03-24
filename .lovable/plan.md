

## Melhorar Layout da Barra Lateral

A sidebar atual já está funcional mas pode ser visualmente refinada. Baseado na imagem de referência e nas melhores práticas de design, vou fazer as seguintes melhorias:

### Mudanças Planejadas

**1. Header mais elegante**
- Separador sutil entre header e menu
- Logo com gradiente ao invés de cor sólida
- Espaçamento mais generoso

**2. Menu items com melhor feedback visual**
- Ícones maiores (h-5 w-5) para melhor legibilidade
- Item ativo com barra lateral colorida (indicador de seleção à esquerda)
- Hover com transição suave e fundo mais visível
- Espaçamento entre items aumentado
- Border-radius mais arredondado nos items

**3. Footer do usuário refinado**
- Avatar com gradiente
- Ícone de logout/chevron para indicar interatividade
- Separador visual antes do footer
- Configurações com estilo consistente

**4. Separadores e espaçamento**
- Linha divisória sutil entre seções
- Padding lateral uniforme
- Label "Menu Principal" com estilo mais discreto

### Arquivo editado
- `src/components/AppSidebar.tsx` — redesign completo do layout

