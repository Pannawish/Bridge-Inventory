# Test History Overview

This folder keeps a presentation-friendly history of the backend test runs selected for the Inventory Management project.

## Purpose
- keep a clear record of the tested business workflows
- show the exact automated test cases used
- preserve the result of each run
- make future reruns easy and consistent

## Scope of this test history
The current selected suite contains 30 backend automated tests taken from the real test suite in `backend/inventory/tests.py`.

These 30 cases were selected because they cover the business rules that are easiest to explain in a black-box testing presentation:

- product picture validation
- quotation behavior
- purchase behavior
- purchase receiving and payable logic
- sales stock validation
- billing note eligibility
- payment batch eligibility
- credit note validation

## Current run status
- Latest recorded run: `run-02`
- Result: `30 / 30 passed`
- Code fixes needed after the latest run: `None`

## Files in this folder
- `blackbox-test-cases.md` : simple presentation-friendly black-box test cases
- `test-case-matrix.md` : the 30 selected automated backend cases and what each one checks
- `run-01/summary.md` : first recorded run summary for the earlier 20-case set
- `run-01/raw-output.txt` : preserved console-style result log for the first run
- `run-02/summary.md` : second recorded run summary for the expanded 30-case set
- `run-02/raw-output.txt` : preserved console-style result log for the second run

## Recommended file for presentation
If the audience wants a simpler explanation, use `blackbox-test-cases.md` first.

That file is written in a normal black-box testing style:
- whether the case is valid or invalid
- what the tester does
- what input or condition is used
- what result is expected
- what actual result was observed

The other files keep the deeper automated test history.
