"""Inventory API view surface.

The existing ``inventory.views`` import path remains stable while focused view
modules are introduced for future changes.
"""

from ._legacy import *  # noqa: F401,F403

