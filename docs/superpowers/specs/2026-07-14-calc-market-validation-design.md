# CALC Market Validation Design

## Goal

Add a testing-branch Market Validation experiment that uses GSA CALC pricing data to benchmark client price-list labor categories.

## Scope

- Keep the existing SIN website scan in Market Validation.
- Add a CALC benchmark path for extracted price-list LCATs.
- Use GSA's public CALC ceiling rates endpoint at `https://buy.gsa.gov/pricing/api/v3/search/ceilingrates/`.
- Start with the attached Squared Compass commercial price list sample: SIN `541611` rows for Business Analyst, Project Manager, and Technical Writer/Editor levels.
- Do not remove the existing GSA eLibrary / GSA Advantage benchmark path in this branch.

## UX

The Market Validation workspace will show CALC as the main benchmark action in Step 2. It will explain that uploaded or discovered price-list LCATs feed the CALC run. After a run, the table will show client LCAT, client price, CALC comparable price, median/min/max where available, contractor, contract number, and source link.

## Data Flow

1. Intake extracts price-list LCATs into `automation.priceListLcats`.
2. Market Validation reads the selected SIN and extracted LCATs.
3. The CALC server function builds one CALC query per LCAT, including the selected SIN when present.
4. CALC hits are normalized into market validation rows and summary statistics.
5. Results are saved into the automation store and, when an offer id exists, into automation run logging.

## Error Handling

- If there are no price-list LCATs, keep the existing upload/extract prompt.
- If CALC returns no rows for one LCAT, return a note for that LCAT and continue the rest.
- If the CALC service fails, return an error and keep prior market rows unchanged.

## Testing

- Unit-test CALC URL construction.
- Unit-test CALC response normalization.
- Unit-test pricing posture comparison using the Squared Compass sample rows.
- Run typecheck, targeted tests, full tests, and build before pushing.
