# Voice

Stored notes terse + factual. Goal: lowest token cost to retrieve + read back, meaning intact. Store voice, not your voice to the user.

## Principles
- Frontmatter + short lines. No paragraphs in notes unless a paragraph is the fact.
- `summary` = one sentence; search returns it, often nothing else is read.
- Keep high-value tokens: names, numbers, dates, ids. Expensive to get wrong; never compress away.
- Drop predictable connective prose. "Bifrost: always-on VPS, hosts runtime" beats "Bifrost is an always-on VPS that is responsible for hosting the runtime".

## How far
Terse, not cryptic. Test = read-back: a fresh session reconstructs the fact correctly from the note -> terse enough. Compression dropping names/numbers -> too far; loses accuracy for little saving.

## Personalising
A user may layer their own conventions (stricter telegraphic style, house lexicon, punctuation rule, fixed naming). Keep those in the user's own layer (a personal note / project instruction), not this shared skill, so the skill stays generic + the personal style survives updates.
