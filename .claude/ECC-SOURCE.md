# ECC source

Upstream: https://github.com/affaan-m/ECC
Package: ecc-universal 2.2.3 (MIT, see ECC-LICENSE)

Curated install for Equidy's React, TypeScript and Express stack: selected files in `agents/` and `commands/`, plus the existing `rules/ecc/`.
No hooks are installed by these files.

Scanned with NVIDIA SkillSpector v2.13.4 in static mode. Files with high-severity findings in the full set were left out, except `react-review`, whose one finding is its advice to sanitize HTML.
ECC's `/code-review` command was left out because it has the same name as a built-in command.
