#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Session (June 2026) — Full Admin Control Panel
user_problem_statement: "Create a perfect administrative control panel: 1) receive email of orders + customer-related mails, 2) add/remove/update products (price, size etc), 3) full admin dashboard"

backend:
  - task: "Emergent-managed email notifications (order + contact emails to admin notify_email)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    comment: "send_email via integrations proxy with guardrail gate. Verified: test-email 200, contact email logged ok=true in db.email_log. Order email fired async in create_order."
  - task: "Admin stats endpoint GET /api/admin/stats"
    implemented: true
    working: true
  - task: "Admin orders: GET /api/admin/orders?status=, PATCH /api/admin/orders/{id}/status"
    implemented: true
    working: "NA"
  - task: "Product CRUD: PATCH /api/admin/products/{id} (price/size/cuts/stock/availability), PATCH .../stock (delta), is_available filter on public GET /products"
    implemented: true
    working: true
    comment: "Verified via httpx: patch price+is_available, hidden from public list, stock +/- works"
  - task: "Contact/support: POST /api/contact (auth, throttled), admin inbox GET/PATCH read/DELETE /api/admin/messages"
    implemented: true
    working: true
  - task: "Admin settings: GET/PUT /api/admin/settings (notify_email), POST /api/admin/settings/test-email"
    implemented: true
    working: true
  - task: "Order creation now decrements product stock + emails admin"
    implemented: true
    working: "NA"

frontend:
  - task: "Admin shell with 6 tabs (Dashboard/Orders/Products/Deals/PINs/Inbox)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin.tsx"
  - task: "AdminOverview: stat cards, low stock alerts, notification email settings + test email"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/admin/AdminOverview.tsx"
  - task: "AdminOrders: status filters, expandable order cards, status update actions"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/admin/AdminOrders.tsx"
  - task: "AdminProducts: search, add form, edit modal (price/weights/cuts/stock/image), availability switch, stock +/-"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/admin/AdminProducts.tsx"
  - task: "Support screen /support + profile 'Contact Support' link"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/support.tsx"

test_plan:
  current_focus: ["Admin dashboard e2e (all 6 tabs)", "Order status updates", "Product edit modal + availability + stock", "Support message flow -> admin inbox", "Order placement still works (stock decrement + email fire)"]

agent_communication:
  - agent: "main"
    message: "Built full admin control panel + email notifications. Backend endpoints all smoke-tested OK via httpx. Need full e2e test: admin login (admin@freshcuts.com/Admin@123), all admin tabs, order status flow, product editing, and customer support flow (OTP login mobile any 10-digit, OTP 123456)."

## Session (June 2026) — Search + Subscriptions
backend:
  - task: "Smart search: GET /api/search/suggest?q= (synonym expansion dhaniya->coriander etc), /api/products supports q + min_price/max_price/in_stock"
    implemented: true
    working: true
    comment: "Verified via httpx: dhaniya->Coriander, bhindi->Lady's Finger, aloo->Potato, price filter correct"
  - task: "Subscriptions: POST/GET /api/subscriptions, PATCH /{id} (pause/resume/cancel/frequency), POST /{id}/skip, admin GET /api/admin/subscriptions + POST /api/admin/subscriptions/run; hourly loop generates COD orders (source=subscription), decrements stock, emails admin. LEGACY box-based subscription system REMOVED."
    implemented: true
    working: true
    comment: "Verified full lifecycle via httpx incl. forced run generating an order"
frontend:
  - task: "Shop: auto-suggest dropdown (testID suggest-box, suggest-<id>), synonym hint, filter sheet (filter-btn, price-<id>, instock-switch, filter-reset, filter-apply), debounced search"
    implemented: true
    working: "NA"
  - task: "Subscribe screen /subscribe rewritten: custom basket from cart, qty editing, frequency daily/alternate/weekly + weekday, start date, saved-address picker, per-delivery pricing, COD note (testIDs: sub-name, freq-<id>, day-<Mon..>, start-1/2, sub-addr-<id>, sub-submit)"
    implemented: true
    working: "NA"
  - task: "/subscriptions manage screen: pause/resume (sub-pause-<id>), skip (sub-skip-<id>), cancel two-tap (sub-cancel-<id>), + new (subs-new)"
    implemented: true
    working: "NA"
  - task: "Entry points: cart 'subscribe-basket-btn', profile 'profile-subscriptions', home banner -> /subscribe; AdminOrders '🔁 sub' badge; AdminOverview subscriptions/deals stat cards"
    implemented: true
    working: "NA"
agent_communication:
  - agent: "main"
    message: "Backend fully smoke-tested. Need frontend e2e for search suggestions/filters and subscription create/manage flows."
