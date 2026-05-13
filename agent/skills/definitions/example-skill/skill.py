"""Example skill custom execution logic."""


async def execute(params: dict) -> str:
    """Called when the skill has custom execution logic."""
    args = params.get("args", "")
    return f"Example skill executed with args: {args}"
