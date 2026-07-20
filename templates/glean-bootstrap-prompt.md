Save the final Markdown profile to `context/profile.md` in this workspace, overwriting if present. This environment requires the file write — do not only return the profile in chat. When the file is written, tell me it is ready for review in Work HQ.

---

Create an exhaustively comprehensive onboarding profile for [FULL_NAME] ([WORK_EMAIL]).

Purpose:
This profile will be saved as a Markdown file and used as long-term context for that person's AI assistant as part of a "personal productivity operating system".

Your job:
Use Glean MCP / Glean enterprise data to build a high-signal Markdown profile that helps an AI assistant understand who this person is, what they do, how they work, what outcomes they are responsible for, and how best to support them in day-to-day work.

Research approach for scale:

1. Start with Glean people data and treat it as the canonical source for current identity fields:
   - full name
   - current title
   - email
   - manager
   - location
   - department / business unit
   - direct reports
   - start date
2. Do not derive the current title from historical documents if Glean people data already provides it.
3. Use documents only to enrich current scope, priorities, operating style, and work context.
4. Prioritise recent and high-signal sources over broad historical searching. Default to the last 12–18 months unless an older source is clearly foundational.
5. Use a small number of targeted searches rather than broad exploratory searching. Prefer depth on the most relevant docs over breadth across weak sources.
6. Prioritise sources such as:
   - people profile
   - current OKR docs
   - current initiative / program docs
   - onboarding docs for the team or domain
   - recent strategy / blueprint / roadmap documents
   - recent meeting notes or transcripts only when they reveal concrete working style or decision patterns
7. Avoid "from the beginning of time" synthesis. Historical sources should only be used when they add unique context not available in current sources.

Important rules:

1. Use the person's full name and email to identify the correct employee.
2. Separate clearly:
   - Confirmed facts
   - Derived interpretations
   - Unknowns / needs validation
3. Prefer concrete evidence over vague statements.
4. Do not include generic filler such as "works cross-functionally" unless you can name the actual teams, stakeholders, or repeated collaboration patterns.
5. If multiple titles appear in documents, use Glean people data as the canonical current title and list other titles only as historical or internal variants.
6. Do not quote large blocks of source material.
7. Write clearly and compactly, but be comprehensive.
8. The final output must be in Markdown.
9. Write in first person where useful for future assistant context, but preserve accuracy. Example: "I work across…" is acceptable if the evidence is strong.
10. Include a strong "AI assistant guidance" section that translates the profile into practical support instructions.
11. Surface evidence gaps explicitly rather than smoothing over them.
12. Optimize for usefulness to future AI assistants, not for biography completeness.

Required sections:

1. Executive summary
2. Identity and current role
3. Business area
4. Role scope and responsibilities
5. Major projects / programs
6. Manager
7. Team managed
8. Direct reports
9. Key collaborators / stakeholder network
10. Known OKRs and goals
11. Decision-making scope
12. Derived work style
13. Derived communication style
14. Operating cadence / rituals
15. Tools, systems, and domains they appear closest to
16. Domain expertise / subject-matter areas
17. Risks, constraints, or recurring problem themes in their work
18. Preferences or patterns an AI assistant should know
19. Open questions / assumptions to validate with the person

Add at least 8 additional attributes beyond the required list, chosen based on evidence. Prioritise the richest and most operationally useful dimensions, such as:

- leadership style
- product philosophy
- customer orientation
- documentation style
- meeting style
- cross-functional influence style
- change-management orientation
- technical fluency
- data fluency
- escalation patterns
- success metrics they care about
- likely motivators
- likely frustrations / friction points
- strategic horizon (short-term vs long-term)
- ambiguity tolerance
- decision velocity
- operating principles
- AI/tool usage signals
- stakeholder management style
- delivery risk patterns

Guidance to avoid vague output:

1. Do not write broad claims without examples.
2. If you say the person is strategic, explain what evidence shows that.
3. If you say the person is technical or data-literate, tie it to the kinds of documents, decisions, or systems they engage with.
4. If you infer communication style, use signals from actual artifacts such as Slack tone, authored docs, meeting transcripts, review comments, or agenda structure.
5. If a section is weakly evidenced, keep it short and mark it Unknown / needs validation.
6. Prefer named stakeholders, named systems, named programs, and measurable goals over abstract summaries.

Output requirements:

- Title the document: `# [FULL_NAME] — AI Context Profile`
- Use a `## ` heading for every section.
- For each section, label content as one of:
  - Confirmed
  - Derived
  - Unknown / needs validation
- Where useful, use compact tables for identity, team, collaborators, goals, and metrics.
- Always include a section called: "Open questions / assumptions to validate" listing explicit evidence gaps.
- End with a section called: "How my AI assistant should support me".
- In that final section, provide practical bullets such as:
  - how to draft for me
  - how to summarize for me
  - what level of detail I likely prefer
  - how to handle ambiguity for me
  - how to prepare meetings, updates, decisions, and follow-ups for me
  - what kinds of trade-offs to surface
  - when to be concise vs detailed
  - what evidence standard to use before making claims on my behalf

Response size management:

- Target roughly 1,500–3,000 words.
- Prefer dense tables over long prose for factual sections such as identity, team, stakeholders, goals, metrics, and systems.
- Keep most sections to 2–5 bullets or a short paragraph unless the section is especially high-signal.
- Compress weakly evidenced sections instead of expanding them with generic filler.
- Do not include exhaustive source recaps, long examples, or repeated phrasing.
- If the draft is getting too long, shorten in this order:
  1. reduce repetition
  2. convert prose to tables
  3. trim low-signal derived attributes
  4. collapse thin sections into 1–2 bullets

Desired output style:

- Comprehensive, structured, useful, and reusable.
- Avoid fluff.
- Make it feel like a high-quality internal briefing converted into assistant-ready context.
- Bias toward operational usefulness over narrative biography.
- If evidence is thin in an area, say so explicitly.
- Prefer "compact but rich" over "exhaustive but bloated."

Write the finished profile to `context/profile.md` as instructed at the top, then confirm it is ready for review.
