# Exam mode and answer effects

Exam is an exclusive selection mode. The default remains exploration + review. It uses the existing cryptographic RNG, equal weight per word within the selected levels and question kinds, with up to five distinct words per frozen set. Memory state, due date and ability do not weight this selection. Words can return in subsequent sets; exam does not end just because exploration and due review are empty. Existing lives, time limits and manual finish still apply.

Answers carry mode=exam through the session, offline journal, API and answer_log. The same FSRS reducer processes them. A first encounter in exam therefore removes that word from later exploration; an incorrect answer becomes eligible for review under the existing failed-answer rule. No user history was changed to test the feature.

The migration broadens answer_log_mode_check while preserving exploration, review and legacy NULL. Its local version matches the applied remote migration. A temporary table copied the production constraints to verify all four values inside a rolled-back transaction.

Correct-answer effects fade the card into eight pastel glass pieces with a light ring and ten small glints. They finish inside the existing 320 ms feedback window. Three hearts use the rabbit's persistent reaction clock and continue across question redraws. Full-screen flashes are removed, and reduced-motion uses static feedback. No sound, new asset download or effect-specific database state is required.

Validation: deterministic stratified draws across 200 first picks prove equal candidate weighting; ten sets check uniqueness and continued play after exploration is exhausted; real FSRS/session/schema tests cover learning updates and API acceptance. Browser checks cover 15 consecutive exam answers, mode exclusivity, result counts, mobile rendering and reduced motion.
