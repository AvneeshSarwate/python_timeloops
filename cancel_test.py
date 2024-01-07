import asyncio

async def counter():
    for i in range(1, 11):
        print(i)
        await asyncio.sleep(0.5)

async def cancel_counter_after_2_seconds():
    task = asyncio.create_task(counter())
    await asyncio.sleep(2)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("Counter was cancelled")

# if __name__ == "__main__":
#     asyncio.run(cancel_counter_after_2_seconds())
