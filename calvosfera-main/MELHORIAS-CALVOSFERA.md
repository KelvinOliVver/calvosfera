# Melhorias da Calvosfera

## O que mudou
- Cargos com etiquetas visuais no chat, na lista de membros e no perfil: Admin, Moderador e VIP.
- Novos comandos administrativos `/cargo`, `/cargos` e ajuda atualizada.
- A atribuição de cargos passa por uma função de servidor com verificação de admin; não é feita diretamente pelo navegador.
- Fonte atualizada para Inter + Space Grotesk, com espaçamento, renderização e barras de rolagem refinados.
- Arquivo `.env` removido do pacote e ignorado pelo Git; use `.env.example` como referência.

## Importante: aplicar a migração
No painel Supabase do projeto, abra **SQL Editor** e execute o conteúdo de `drizzle/migrations/0005_roles.sql` antes de usar os cargos Moderador e VIP.

## Comandos
- `/ajuda` — lista comandos
- `/cargos` — explica os cargos
- `/cargo nick admin`
- `/cargo nick moderador`
- `/cargo nick vip`
- `/cargo nick membro`
- `/cargo nick remover`

Os comandos continuam restritos a administradores. Moderador e VIP são cargos de exibição nesta versão; as permissões de moderação existentes continuam exclusivas do admin.

## Configuração local
Copie `.env.example` para `.env` e preencha os valores do seu projeto Supabase. Nunca envie credenciais privadas para um repositório público.
