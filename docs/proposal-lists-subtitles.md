# Proposal lists and package subtitles

Objectives, included/excluded scope items, client materials, and package inclusion/exclusion items use the shared per-line list renderer. Blank lines are ignored; existing hyphens, bullet characters and numeric prefixes are removed for display to avoid duplicate markers. Stored text and financial values remain unchanged. Free-form prose retains its existing presentation.

Optional package subtitles have a dedicated purple, semibold style and are hidden when blank. Editor labels identify the per-line fields.

Files: proposalPresentation.tsx, ProposalPremiumEditor.tsx, proposalPremium.css, proposalPremium.test.tsx. No API/schema/dependency changes or migration.

Validation: Node 22.23.4; API/frontend typechecks and builds passed; 729 tests passed. Browser checks of the shared document at 1440px and 390px confirmed purple subtitles, native bullets for scope/material lists, existing package check markers, and no horizontal overflow.

Not deployed; isolated PR for review. PR #54 untouched.
