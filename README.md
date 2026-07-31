# Passo a passo para executar os projetos sem erros

Este guia considera a integração entre o projeto web e o projeto mobile do repositório, usando os backends e os frontends presentes em:

- [app](app)
- [app-mobile-spm](app-mobile-spm)
- [shared](shared)

## 1. Pré-requisitos

Instale ou verifique:

- Node.js 20 LTS ou superior
- npm ou yarn
- Python 3.11+ (para compatibilidade com o projeto mobile e dependências auxiliares)
- Git
- Expo CLI (opcional, mas recomendado para o frontend mobile)

No PowerShell, confirme:

```powershell
node -v
npm -v
python --version
```

Se necessário, instale o Expo CLI:

```powershell
npm install -g expo-cli
```

## 2. Instale as dependências dos quatro ambientes

Abra um terminal na raiz do projeto e rode:

```powershell
cd .\app\backend
npm install

cd ..\frontend
npm install

cd ..\..\app-mobile-spm\backend
npm install

cd ..\frontend
npm install
```

> Se houver erro de dependência no frontend mobile, rode novamente:
>
> ```powershell
> npm install
> ```

## 3. Gere o Prisma e aplique o banco compartilhado

Os dois backends usam o mesmo schema compartilhado em [shared/prisma/schema.prisma](shared/prisma/schema.prisma).

### Backend web

```powershell
cd ..\..\app\backend
npm run prisma:generate
npm run prisma:migrate
```

### Backend mobile

```powershell
cd ..\..\app-mobile-spm\backend
npm run prisma:generate
npm run prisma:migrate
```

Esses comandos criam/atualizam o banco SQLite apontado pelas variáveis de ambiente em:

- [app/backend/.env](app/backend/.env)
- [app-mobile-spm/backend/.env](app-mobile-spm/backend/.env)

## 4. Configure as variáveis de ambiente do frontend mobile

Crie ou ajuste o arquivo [app-mobile-spm/frontend/.env.local](app-mobile-spm/frontend/.env.local) com o endereço do backend mobile:

```env
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Se você estiver usando um emulador Android, use:

```env
EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000
```

## 5. Inicie os serviços na ordem correta

Use terminais separados para cada processo.

### Terminal 1 — Backend web

```powershell
cd .\app\backend
npm run dev
```

O backend web deve subir em:

- http://localhost:8001

### Terminal 2 — Backend mobile

```powershell
cd .\app-mobile-spm\backend
npm run dev
```

O backend mobile deve subir em:

- http://localhost:8000

### Terminal 3 — Frontend web

```powershell
cd .\app\frontend
npm start
```

Acesse:

- http://localhost:3000

### Terminal 4 — Frontend mobile

```powershell
cd .\app-mobile-spm\frontend
npx expo start --clear
```

Depois, escolha a opção para abrir no emulador, dispositivo físico ou navegador.

## 6. Validação rápida

### Validar o backend web

```powershell
cd .\app\backend
npm run test:smoke
```

### Validar o frontend web

Acesse o navegador em http://localhost:3000 e teste o fluxo de login/uso.

### Validar o frontend mobile

Abra o app no emulador ou no Expo Go e confirme se ele consegue carregar os dados do backend mobile.

## 7. Soluções para erros comuns

### Erro: Prisma não encontra o schema

Execute novamente:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

### Erro: porta já em uso

Feche os processos antigos ou troque a porta no arquivo de ambiente.

### Erro: frontend não consegue acessar o backend

Verifique se:

- o backend está rodando
- a URL do backend está correta no arquivo de ambiente
- a porta corresponde à que está sendo usada pelo backend

### Erro: Expo não inicia

Tente:

```powershell
npx expo start --clear
```

### Erro: banco SQLite não é criado

Confirme se o caminho em [app/backend/.env](app/backend/.env) e [app-mobile-spm/backend/.env](app-mobile-spm/backend/.env) aponta para um local válido e com permissões de escrita.

## 8. Ordem recomendada para não ter problemas

1. Instalar dependências
2. Gerar Prisma e aplicar migrations
3. Iniciar backend web
4. Iniciar backend mobile
5. Iniciar frontend web
6. Iniciar frontend mobile

Se seguir essa ordem, o fluxo de integração entre os projetos tende a funcionar sem os problemas mais comuns.
