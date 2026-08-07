# CareerPilot — Project Blueprint

This is the complete, from-scratch documentation for CareerPilot: what it is, how every piece
works, and — just as importantly — **why** it was built the way it was. It's written for someone
with basic programming knowledge who needs to understand this specific codebase deeply enough to
maintain it, extend it, or explain it in an interview.

Read these in order the first time. After that, use them as reference.

| Doc | What's in it |
|---|---|
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | The big picture: what CareerPilot does, the tech stack, how the three deployed pieces (frontend, backend, database) talk to each other |
| [02-DATABASE.md](./02-DATABASE.md) | PostgreSQL, EF Core, migrations explained from first principles, the full table schema and how it was built up over time |
| [03-BACKEND.md](./03-BACKEND.md) | ASP.NET Core from the ground up: `Program.cs` line by line, the Model → DTO → Controller pattern, one feature traced end-to-end |
| [04-AUTHENTICATION.md](./04-AUTHENTICATION.md) | JWTs explained from zero, why a second "refresh token" exists, the full login → refresh → logout lifecycle |
| [05-FRONTEND.md](./05-FRONTEND.md) | Angular from the ground up: standalone components, **Signals and `computed()` explained in depth**, RxJS, services, routing, forms, interceptors |
| [06-FEATURES.md](./06-FEATURES.md) | Every feature in the app, what problem it solves, and which files implement it |
| [07-DEPLOYMENT.md](./07-DEPLOYMENT.md) | How code goes from your laptop to the live site — Vercel, Render, Neon, and the CI-less deploy flow this project actually uses |
| [GLOSSARY.md](./GLOSSARY.md) | Every piece of jargon used in these docs, defined in plain language |

## How to use this if you're learning

Don't try to absorb everything in one sitting. A good order:

1. Read **01-ARCHITECTURE** for the map.
2. Read **02-DATABASE** and **03-BACKEND** together — the database and the backend are two
   halves of one idea (EF Core models *are* the database schema).
3. Read **04-AUTHENTICATION** on its own — it's the most conceptually dense part of the backend
   and deserves focused attention.
4. Read **05-FRONTEND**, especially the Signals section — this is almost certainly the newest
   concept if you've used Angular before but not its Signals API (introduced 2023-2024).
5. Skim **06-FEATURES** to connect everything to the screens you've actually clicked through.
6. Read **07-DEPLOYMENT** last, once the code makes sense.

Then keep this folder open in a tab and re-read the relevant doc every time you touch a part of
the app you haven't worked in for a while. That's what documentation is *for* — nobody keeps an
entire full-stack app in their head permanently, including the person who wrote it.
