# Realtime

The main Next.js application polls the unread notification count every 30 seconds while the tab is active, and refreshes it on window focus. React Query shares the count between consumers and cancels requests through the query signal.

Opening the notification center loads the latest notifications. The full notification list uses cursor pagination. Marking notifications as read invalidates the shared notification queries.

Ticket detail uses server rendering and refreshes after mutations. There is currently no ticket timeline polling endpoint.

The standalone websocket examples and notification service are independent development prototypes. The main application does not connect to them; review authentication, room authorization and CORS before deploying those services.
