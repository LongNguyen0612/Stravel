from app.core.tenant import require_tenant

# Re-export as the standard dependency name for session endpoints
get_current_tenant_id = require_tenant
