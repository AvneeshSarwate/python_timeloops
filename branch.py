import asyncio
import time
from typing import Callable, Any, Coroutine, Optional

class TimeContext:
  _context_id: int = 0

  def __init__(self, start_time: float, bpm: float = 120, parent: Optional['TimeContext'] = None) -> None:
    self.time: float = start_time
    self.start_time: float = start_time
    self.bpm: float = bpm
    self.id: int = TimeContext._context_id
    TimeContext._context_id += 1
    self.is_canceled: bool = False
    self.parent: Optional['TimeContext'] = parent

  async def wait_sec(self, sec: float) -> None:
    if self.is_canceled:
      raise asyncio.CancelledError('Context is canceled')

    actual_start = time.time()
    await asyncio.sleep(sec)
    actual_duration = time.time() - actual_start

    # Correcting time drift
    self.time += sec
    if actual_duration - sec > 0.010:
      print('Wait duration deviation greater than 10 ms')

  def wait_beats(self, beats: float) -> Coroutine[Any, Any, None]:
    return self.wait_sec(beats * 60 / self.bpm)

  def cancel(self) -> None:
    self.is_canceled = True

  async def branch(self, block: Callable[['TimeContext'], Coroutine[Any, Any, Any]]) -> asyncio.Task[Any]:
    child_ctx = TimeContext(self.time, self.bpm, self)
    child_task = asyncio.create_task(block(child_ctx))
    return child_task

  async def branch_wait(self, block: Callable[['TimeContext'], Coroutine[Any, Any, Any]]) -> Any:
    child_ctx = TimeContext(self.time, self.bpm, self)
    result = await block(child_ctx)
    self.time = max(self.time, child_ctx.time)
    return result

async def launch(block: Callable[['TimeContext'], Coroutine[Any, Any, Any]], tree_root_start_time: float) -> Any:
  start_time = time.time() - tree_root_start_time
  ctx = TimeContext(start_time)
  return await asyncio.create_task(block(ctx))

def another_task(id_string: str) -> Callable[['TimeContext'], Coroutine[Any, Any, str]]:
  async def fn(ctx: TimeContext) -> str:
    await ctx.wait_sec(1)
    print("Another task done", id_string, ctx.time)
    return "Completed"
  return fn

async def some_task(ctx: TimeContext) -> None:
  # Example usage of branch and branch_wait
  branch_task = ctx.branch(another_task("one"))
  result = await ctx.branch_wait(another_task("two"))
  print("Branch wait result:", result, ctx.time)
  await branch_task
  await ctx.wait_sec(1)
  print("Task done")

if __name__ == "__main__":
  asyncio.run(launch(some_task, time.time()))
