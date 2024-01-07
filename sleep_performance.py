import asyncio
import numpy as np

async def sleep_and_measure(delay):
    start = asyncio.get_event_loop().time()
    await asyncio.sleep(delay)
    end = asyncio.get_event_loop().time()
    return end - start - delay

async def main():
    delay = 0.005  # 10 milliseconds
    measurements = []

    for _ in range(1000):
        measurement = await sleep_and_measure(delay)
        measurements.append(measurement)

    measurements = np.array(measurements)
    mean_deviation = np.mean(measurements)
    percentile_75 = np.percentile(measurements, 75)
    percentile_90 = np.percentile(measurements, 90)
    percentile_99 = np.percentile(measurements, 99)

    return mean_deviation, percentile_75, percentile_90, percentile_99

# Run the asyncio program
deviations = asyncio.run(main())
print(deviations)
