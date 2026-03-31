# Meeting Notes — Product Review (Sample)

Date: 2026-03-20

## Attendees
- Product
- Engineering
- Operations

## Agenda
- Review current document processing pipeline
- Identify bottlenecks in parsing and field extraction
- Confirm export formats and usability improvements

## Discussion Highlights

### Parsing Pipeline
- Parsing is currently deterministic for text-based documents.
- For non-text formats, mock extraction ensures consistent UI behavior.

### Field Extraction
- Extracted fields should be editable prior to finalization.
- Keywords need to be stored as a list for export.

### Export & Workflow
- Provide JSON and CSV export options.
- Add bulk CSV export for finalized documents.

## Action Items
1. Validate SSE progress event ordering.
2. Improve dashboard filtering and pagination.
3. Confirm retry behavior after failures.

## Next Meeting
- 2026-04-03
  - Focus: workflow reliability and user edits persistence

