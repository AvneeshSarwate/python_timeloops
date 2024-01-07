//todo api - make then/catch/finally chainable on CancelablePromisePoxy
class CancelablePromisePoxy<T> implements Promise<T> {
  public promise?: Promise<T>
  public abortController: AbortController

  constructor(ab: AbortController) {
    this.abortController = ab
  }

  public cancel() {
    this.abortController.abort()
  }

  [Symbol.toStringTag]: string = '[object CancelablePromisePoxy]'

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.promise!!.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<T | TResult> {
    return this.promise!!.catch(onrejected)
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.promise!!.finally(onfinally)
  }
}

let contextId = 0

type Constructor<T> = new (...args: any[]) => T;
function createAndLaunchContext<T, C extends TimeContext>(block: (ctx: C) => Promise<T>, rootTime: number, ctor: Constructor<C>, updateParent: boolean, parentContext?: C): CancelablePromisePoxy<T> {
  const abortController = new AbortController()
  const promiseProxy = new CancelablePromisePoxy<T>(abortController)
  const newContext = new ctor(rootTime, abortController, contextId++)
  const blockPromise = block(newContext)
  promiseProxy.promise = blockPromise
  const bp = blockPromise.catch((e) => {
    const err = e as Error
    console.log('promise catch error', err, err?.message, err?.stack)
  })
  if (parentContext) {
    bp.finally(() => {
      //todo bug - a branched child should only update it's parent's time when awaited
      if(updateParent) parentContext.time = Math.max(newContext.time, parentContext.time) 
    })
  }
  return promiseProxy
}

const USE_TONE = false
//todo hotreload - need to register all launches to global state so they can be canceled on hot reload
export function launch<T>(block: (ctx: TimeContext) => Promise<T>): CancelablePromisePoxy<T> {
  return createAndLaunchContext(block, performance.now()/1000, DateTimeContext, false)
}

//todo draft - need to test generalized TimeContext implementation in loops
export abstract class TimeContext {
  public abortController: AbortController
  public time: number
  public startTime: number
  public isCanceled: boolean = false
  public get progTime(): number {
    return this.time - this.startTime
  }
  public id: number
  public bpm: number = 120

  constructor(time: number, ab: AbortController, id: number) {
    this.time = time
    this.startTime = time
    this.abortController = ab
    this.id = id
    this.abortController.signal.addEventListener('abort', () => {
      this.isCanceled = true
      console.log('abort')
    })
  }
  public branch<T>(block: (ctx: TimeContext) => Promise<T>): void {
    createAndLaunchContext(block, this.time, Object.getPrototypeOf(this).constructor, false, this)
  }

  public branchWait<T>(block: (ctx: TimeContext) => Promise<T>): CancelablePromisePoxy<T> {
    return createAndLaunchContext(block, this.time, Object.getPrototypeOf(this).constructor, true, this)
  } 

  public abstract waitSec(sec: number): Promise<void>
  public wait(beats: number) {
    return this.waitSec(beats * 60 / this.bpm)
  }
}

class DateTimeContext extends TimeContext{
  public async waitSec(sec: number) {
    // console.log('wait', sec, this.id, this.time.toFixed(3))
    if (this.isCanceled) {
      throw new Error('context is canceled')
    }
    const ctx = this
    return new Promise<void>((resolve, reject) => {
      const listener = () => { reject(); console.log('abort') }
      ctx.abortController.signal.addEventListener('abort', listener)
      const waitTime = this.time + sec - performance.now() / 1000
      const waitStart = performance.now()
      setTimeout(() => {
        ctx.time += sec
        ctx.abortController.signal.removeEventListener('abort', listener)
        resolve()
        const waitDuration = performance.now() - waitStart
        // console.log('wait duration', (waitDuration / 1000).toFixed(3), 'wait time', waitTime.toFixed(3))
        if(waitDuration/1000 - waitTime > 0.010) console.log('wait duration deviation greater than 10 ms')
      }, waitTime * 1000)
    })
  }
}



function dateDelay(callback: () => void, nowTime: number, delayTime: number): void {
  setTimeout(() => {
    callback()
  }, delayTime * 1000)
}
const startTime = performance.now() / 1000
const dateNow = () => performance.now() / 1000 - startTime
