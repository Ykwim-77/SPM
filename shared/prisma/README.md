# Prisma compartilhado

`schema.prisma` e `migrations/` são a única fonte de verdade do banco SQLite
usado pelo sistema web e pelo backend mobile. Execute migrations somente pelo
backend web (`npm run prisma:migrate` em `app/backend`). Os dois backends devem
gerar seus clientes com `npm run prisma:generate` antes de iniciar.
