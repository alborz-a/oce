"""Guide overrides: the system admin shows or hides each module's "How it works" guide
per scope (global, role, user) and can replace its text. Default for everyone is hidden.
"""


async def on_startup() -> None:
    """Nothing to register: access is checked with RequireRole("admin") on the write routes."""
