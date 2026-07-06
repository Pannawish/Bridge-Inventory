"""Inventory service API.

The public ``inventory.services`` import path is preserved while service code is
split into smaller domain modules. New code should prefer importing from a
focused module such as ``inventory.services.stock`` or
``inventory.services.dashboard``.
"""

from ._legacy import *  # noqa: F401,F403

