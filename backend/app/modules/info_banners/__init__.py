"""Info banners: the system admin decides per page whether the blue help banner is shown
to everyone and with which text. Default for non-admin users is hidden.
"""


async def on_startup() -> None:
    """Nothing to register: access is checked with RequireRole("admin") on the write route."""
