# Architecture rules
- Manual transfers use one authenticated database transaction shared by Kanban and Conversations; this keeps client, lead and audit assignments consistent without broadening direct table permissions.
- Project dialogs require the parent record's seller ID from each caller and use it for new inserts; this prevents session roles from overriding the responsible seller.
- Lead editing stage options derive from KANBAN_STAGES and preserve the existing lost state when applicable; this prevents valid board stages from rendering blank or being erased during unrelated edits.