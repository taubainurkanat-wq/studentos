/* HTTP transport with explicit session and unauthorized callbacks. */
export function createApi(getToken, onUnauthorized) {
  return async function api(path,{method='GET',body,authorized=true}={}){
    const headers={}; if(body!==undefined) headers['Content-Type']='application/json';
    if(authorized&&getToken()) headers.Authorization=`Bearer ${getToken()}`;
    let response;
    try{response=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
    catch{throw Error('Cannot connect to the server. Is StudentOS running?');}
    let data;try{data=await response.json();}catch{data={};}
    if(!response.ok){if(response.status===401&&authorized){onUnauthorized();}const detail=data.detail;throw Error(typeof detail==='string'?detail:Array.isArray(detail)?detail.map(e=>e.msg).join(', '):`Request failed (${response.status})`);}
    return data;
  }
}
