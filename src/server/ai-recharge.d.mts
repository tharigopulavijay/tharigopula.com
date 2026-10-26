export function signRecharge(secret:string,timestamp:string,body:string):Promise<string>;
export function handleAiRecharge(request:Request,env:Record<string,string|undefined>,fetcher?:typeof fetch):Promise<Response>;
