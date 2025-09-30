# Database Migrations

This directory contains database migration files using node-pg-migrate.

## Migration Files

- `001_baseline_schema.sql` - Clean baseline schema (user_tokens table only)

## Running Migrations

```bash
# Run all pending migrations
npm run db:migrate:up

# Rollback last migration
npm run db:migrate:down

# Create new migration
npm run db:migrate:create migration_name

# Run migrations with logging
npm run db:migrate:run
```

## Migration Naming Convention

- Use sequential numbering: `001_`, `002_`, etc.
- Use descriptive names: `001_initial_schema.sql`
- Include date in comments: `-- Date: 2024-01-15`

## Migration Template

Use the template in `migration-template.sql` when creating new migrations.

## Best Practices

1. **Always test migrations** on a copy of production data
2. **Include rollback statements** in the down migration
3. **Use transactions** for complex migrations
4. **Add indexes** after data migration for better performance
5. **Document changes** in migration comments
6. **Keep migrations small** and focused on single changes
