import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
S=lambda **kw:dict(type='string',**kw)
N=lambda **kw:dict(type='number',**kw)
I=lambda **kw:dict(type='integer',**kw)
B={'type':'boolean'}
O=lambda p,r=[]:dict(type='object',properties=p,required=r,additionalProperties=False)
A=lambda x:dict(type='array',items=x)
R=lambda x:{'$ref':'#/components/schemas/'+x}
uuid=S(format='uuid');positive=N(exclusiveMinimum=0);locale=S(enum=['en','pl','de'])
ip={'venue':S(enum=['binance','bybit','okx'],default='binance'),'market':S(enum=['spot','perpetual'],default='spot'),'symbol':S(pattern='^[A-Z0-9]{2,20}USDT$',default='BTCUSDT'),'timeframe':S(enum=['1m','3m','5m','15m','30m','1h','2h','4h','6h','12h','1d','1w','1M'],default='1h')}
ai={'agentId':uuid,'provider':S(enum=['openai','gemini','anthropic','openrouter','local']),'model':S(minLength=1,maxLength=100),'locale':locale}
schemas={'Instrument':O(ip),'Error':O({'code':S(),'request_id':uuid},['code','request_id']),'Acknowledgement':{'type':'object','additionalProperties':True},'JsonRecord':{'type':'object','additionalProperties':True,'description':'Database row; numeric SQL columns serialize as decimal strings. See SQL migrations for fields.'},'Candle':O({'timestamp':N(),'open':N(),'high':N(),'low':N(),'close':N(),'volume':N(),'closed':B},['timestamp','open','high','low','close','volume','closed']),'AnalysisRequest':O(ip|ai|{'mode':S(enum=['quick','deep','explain']),'indicatorPeriod':I(minimum=2,maximum=200,default=14)},['provider','model','locale','mode']),'AnalysisJob':{'type':'object','properties':{'id':uuid,'status':S(enum=['queued','running','completed','failed']),'result':{'anyOf':[R('Analysis'),{'type':'null'}]},'cost_usd':{'type':['string','number','null']},'error_code':{'type':['string','null']}},'required':['id','status'],'additionalProperties':True},'Analysis':json.load(open(root/'packages/contracts/analysis.schema.json')),'Drawing':O(ip|{'kind':S(maxLength=60),'payload':O({'name':S(maxLength=60),'points':A(O({'timestamp':N(),'value':N(),'dataIndex':N()})),'styles':{'type':'object','additionalProperties':True},'lock':B,'visible':B,'extendData':{}},['name','points']),'version':I(minimum=0,default=0)},['kind','payload']),'Journal':O({'symbol':ip['symbol'],'side':S(enum=['LONG','SHORT']),'entry':positive,'exit':positive,'quantity':positive,'fees':N(minimum=0),'notes':S(maxLength=4000)},['symbol','side','entry','exit','quantity','fees']),'RiskRequest':O({'account':positive,'riskPct':N(exclusiveMinimum=0,maximum=5),'entry':positive,'stop':positive,'target':positive,'leverage':N(minimum=1,maximum=100),'direction':S(enum=['LONG','SHORT']),'feeBps':N(minimum=0,default=10),'slippageBps':N(minimum=0,default=5)},['account','riskPct','entry','stop','leverage','direction'])}
# Embedded schema is a component, so resolve its local $defs pointers there.
schemas['Analysis'].pop('$id',None);schemas['Analysis'].pop('$schema',None)
def fix(x):
 if isinstance(x,dict):
  for k,v in x.items():
   if k=='$ref' and v.startswith('#/$defs/'): x[k]=v.replace('#/$defs/','#/components/schemas/Analysis/$defs/')
   else:fix(v)
 elif isinstance(x,list):
  for v in x:fix(v)
fix(schemas['Analysis'])
paths={}
def route(path,method,body=None,response=None,public=False,status=200,query=None,binary=None,idempotent=False):
 op={'operationId':method+'_'+path.strip('/').replace('/','_').replace('{','').replace('}','').replace('-','_'),'security':[] if public else [{'session':[]},{'mobileBearer':[]}],'responses':{str(status):{'description':'Success','content':{binary or 'application/json':{'schema':response or R('Acknowledgement')}}}}}
 for code in [400,401,403,404,409,429,503]:op['responses'][str(code)]={'description':{400:'Invalid input',401:'Session required',403:'CSRF/origin or consent rejected',404:'Missing tenant-owned resource',409:'Version or idempotency conflict',429:'Quota or risk limit',503:'Integration unavailable'}[code],'content':{'application/json':{'schema':R('Error')}}}
 parameters=[]
 if '{id}' in path:parameters.append({'name':'id','in':'path','required':True,'schema':uuid})
 for name,schema in (query or {}).items():parameters.append({'name':name,'in':'query','schema':schema})
 if method!='get' and not public:parameters.append({'name':'x-csrf-token','in':'header','required':False,'schema':S(),'description':'Required for cookie sessions: fetch from auth/me. Native bearer sessions omit CSRF. Both transports send the exact APP_ORIGIN Origin header.'})
 if idempotent:parameters.append({'name':'idempotency-key','in':'header','required':True,'schema':S(minLength=8,maxLength=150)})
 if parameters:op['parameters']=parameters
 if body is not None:op['requestBody']={'required':True,'content':{'application/json':{'schema':body}}}
 paths.setdefault(path,{})[method]=op
route('/health','get',public=True)
for p in ['markets','candles','depth','derivatives','context','news']:route('/'+p,'get',public=True,response=A(R('JsonRecord')) if p in ['markets','news'] else R('JsonRecord'),query=ip if p not in ['context','news'] else {})
paths['/candles']['get']['responses']['200']['content']['application/json']['schema']={'type':'object','properties':{'candles':A(R('Candle')),'indicators':R('JsonRecord'),'instrument':R('Instrument')},'additionalProperties':True}
paths['/candles']['get']['parameters'] += [{'in':'query','name':n,'schema':s} for n,s in {'limit':I(minimum=1,maximum=3000),'from':N(),'fallback':B,'anchorPrice':positive,'period':I(minimum=2,maximum=200)}.items()]
route('/risk','post',R('RiskRequest'),R('JsonRecord'),True)
route('/auth/wallet/challenge','post',O({'address':S(pattern='^0x[0-9a-fA-F]{40}$'),'chainId':I(minimum=1),'purpose':S(enum=['auth','link','unlink'],default='auth'),'locale':locale},['address','chainId']),R('JsonRecord'),public=True)
route('/auth/wallet/verify','post',O({'challengeId':uuid,'message':S(maxLength=3000),'signature':S(pattern='^0x[0-9a-fA-F]{130}$'),'consent':B,'totp':S(maxLength=10)},['challengeId','message','signature']),R('JsonRecord'),public=True)
route('/wallets','get',response=A(R('JsonRecord')))
route('/auth/oauth/verify-totp','post',O({'code':S(minLength=6,maxLength=6)},['code']),public=True)
route('/auth/resend-verification','post',O({'email':S(format='email')},['email']),public=True)
route('/auth/register','post',O({'email':S(format='email'),'password':S(minLength=12,maxLength=128),'locale':locale,'consent':{'const':True}},['email','password','consent']),public=True,status=201)
route('/auth/login','post',O({'email':S(format='email'),'password':S(maxLength=128),'totp':S(maxLength=10)},['email','password']),public=True)
for p,b in [('verify',O({'token':S(minLength=64,maxLength=64)},['token'])),('reset-request',O({'email':S(format='email')},['email'])),('reset',O({'token':S(minLength=64,maxLength=64),'password':S(minLength=12,maxLength=128)},['token','password']))]:route('/auth/'+p,'post',b,public=True)
route('/auth/mobile/start','post',O({'codeChallenge':S(pattern='^[A-Za-z0-9_-]{43}$'),'state':S(pattern='^[a-f0-9]{64}$')},['codeChallenge','state']),R('JsonRecord'),public=True,status=201)
route('/auth/mobile/request/{id}','get',response=R('JsonRecord'),public=True)
route('/auth/mobile/authorize','post',O({'requestId':uuid,'totp':S(maxLength=10)},['requestId']),R('JsonRecord'))
route('/auth/mobile/exchange','post',O({'requestId':uuid,'code':S(pattern='^[a-f0-9]{64}$'),'codeVerifier':S(pattern='^[A-Za-z0-9_-]{43}$')},['requestId','code','codeVerifier']),R('JsonRecord'),public=True)
route('/auth/me','get',public=True,response=R('JsonRecord'));route('/auth/logout','post',O({}));route('/auth/oauth/start','get',public=True,status=302);route('/auth/oauth/callback','get',public=True,status=302)
route('/ws-ticket','post',O({}),R('JsonRecord'));route('/consents','post',O({}))
route('/settings','get',response=R('JsonRecord'));route('/settings','patch',O({'locale':locale,'timezone':S(maxLength=80),'settings':O({'theme':S(enum=['dark','light']),'telegramChatId':S(),'dailyLossLimit':positive,'maxDrawdownPct':N(exclusiveMinimum=0,maximum=100)})},['locale','timezone']))
route('/totp','get',response=R('JsonRecord'));route('/totp','post',O({'secret':S(minLength=16,maxLength=100),'code':S(minLength=6,maxLength=6)},['secret','code']));route('/totp','delete',O({'password':S(),'code':S()},['code']))
for p in ['credentials','templates','alerts','schedules','journal','backtests']:route('/'+p,'get',response=A(R('JsonRecord')));route('/'+p+'/{id}','delete') if p not in ['backtests'] else None
route('/models','get',response=R('JsonRecord'),query={'provider':ai['provider'],'agentId':uuid})
route('/models','post',O({'provider':ai['provider'],'key':S(minLength=8,maxLength=1000),'agentId':uuid},['provider']),R('JsonRecord'))
route('/credentials','post',O({'provider':S(enum=['openai','gemini','anthropic','openrouter']),'key':S(minLength=8,maxLength=1000)},['provider','key']))
route('/templates','post',O({'name':S(minLength=1,maxLength=100),'config':R('JsonRecord')},['name','config']),R('JsonRecord'))
route('/analyses','get',response=A(R('AnalysisJob')));route('/analyses/{id}','get',response=R('AnalysisJob'));route('/analyses','post',R('AnalysisRequest'),R('AnalysisJob'),status=202,idempotent=True)
route('/chat','post',O(ip|ai|{'message':S(minLength=1,maxLength=4000)},[k for k in ai if k!='agentId']+['message']),R('JsonRecord'))
route('/drawings','get',response=A(R('JsonRecord')),query=ip);route('/drawings/{id}','put',R('Drawing'),R('JsonRecord'));route('/drawings/{id}','delete')
route('/watchlist','get',response=A(R('JsonRecord')))
for m in ['post','delete']:route('/watchlist',m,R('Instrument'))
alert=O({'kind':S(enum=['price','indicator','ai_signal','drawing']),'condition':O(ip|{'comparison':S(enum=['above','below']),'price':positive,'value':N(),'indicator':S(enum=['RSI','EMA20']),'drawingId':uuid}),'channels':A(S(enum=['in_app','email','telegram','push']))},['kind','condition','channels'])
route('/alerts','post',alert,R('JsonRecord'));route('/schedules','post',O({'interval_minutes':I(minimum=15,maximum=10080),'config':R('AnalysisRequest')},['interval_minutes','config']),R('JsonRecord'))
route('/notifications','get',response=A(R('JsonRecord')));route('/notifications','put',O({}))
route('/push','post',O({'endpoint':S(format='uri',maxLength=2000),'keys':O({'p256dh':S(maxLength=500),'auth':S(maxLength=100)},['p256dh','auth'])},['endpoint','keys']))
route('/journal','post',R('Journal'),R('JsonRecord'));route('/journal-review','post',O(ai,[k for k in ai if k!='agentId']),R('JsonRecord'))
route('/attachments','post',O({'journalId':uuid,'mimeType':S(enum=['image/png','image/jpeg']),'base64':S(maxLength=2700000)},['journalId','mimeType','base64']),R('JsonRecord'));route('/attachments/{id}','get',binary='image/png',response={'type':'string','format':'binary'});route('/attachments/{id}','delete')
route('/paper/account','get',response=R('JsonRecord'))
route('/paper/orders','post',O(ip|{'direction':S(enum=['LONG','SHORT']),'quantity':N(minimum=1e-8,maximum=1000000),'orderType':S(enum=['market','limit'],default='market'),'limitPrice':positive,'stopLoss':{'type':['number','null'],'exclusiveMinimum':0},'takeProfit':{'type':['number','null'],'exclusiveMinimum':0}},['direction','quantity']),R('JsonRecord'),idempotent=True)
paths['/paper/orders']['post']['requestBody']['content']['application/json']['schema']['allOf']=[{'if':{'properties':{'orderType':{'const':'limit'}},'required':['orderType']},'then':{'required':['limitPrice']}}]
route('/paper-close/{id}','post',O({'quantity':N(minimum=1e-8)}),R('JsonRecord'))
paths['/paper-close/{id}']['post']['parameters'].append({'name':'idempotency-key','in':'header','required':False,'schema':S(minLength=8,maxLength=150),'description':'Required for partial closes; strongly recommended for all closes.'})
route('/paper-cancel/{id}','post',O({}),R('JsonRecord'))
route('/paper-protection/{id}','patch',O({'version':I(minimum=1),'stopLoss':{'type':['number','null'],'exclusiveMinimum':0},'takeProfit':{'type':['number','null'],'exclusiveMinimum':0}},['version','stopLoss','takeProfit']),R('JsonRecord'))
route('/backtests','post',O(ip|{'fast':I(minimum=2,maximum=100),'slow':I(minimum=3,maximum=200),'riskPct':N(exclusiveMinimum=0,maximum=5),'initialBalance':positive,'feeBps':N(minimum=0,maximum=100),'slippageBps':N(minimum=0,maximum=100)},['fast','slow','riskPct','initialBalance','feeBps','slippageBps']),R('JsonRecord'),status=202);route('/backtests/{id}','get',response=A(R('JsonRecord')))
route('/daily-brief','get',response=R('AnalysisJob'));route('/daily-brief','post',O(ai,[k for k in ai if k!='agentId']),R('AnalysisJob'),status=202)
route('/scanner/candidates','get',response=R('JsonRecord'),query={k:ip[k] for k in ['venue','market','timeframe']}|{'minVolume':N(minimum=1000000,maximum=1000000000000,default=10000000),'limit':I(minimum=5,maximum=30,default=24),'direction':S(enum=['all','LONG','SHORT'],default='all')})
route('/signals','get',response=A(R('JsonRecord')));route('/correlation','get',response=R('JsonRecord'),query={'symbols':S(),'venue':ip['venue']});route('/scanner','get',response=A(R('JsonRecord')),query={'mode':S(enum=['rules','ai'])});route('/scanner','post',O(ai|{'timeframe':ip['timeframe']},[k for k in ai if k!='agentId']),R('JsonRecord'),status=202,idempotent=True)
route('/exchange/connect','post',O({'apiKey':S(minLength=10,maxLength=200),'secret':S(minLength=10,maxLength=200)},['apiKey','secret']),R('JsonRecord'));route('/exchange/portfolio','get',response=R('JsonRecord'));route('/exchange/trades','get',response=R('JsonRecord'),query={'symbol':ip['symbol']})
route('/reports','post',O({'analysisId':uuid},['analysisId']),{'type':'string','format':'binary'},binary='application/pdf');route('/billing/checkout','post',O({}),R('JsonRecord'));route('/billing/webhook','post',public=True);paths['/billing/webhook']['post']['parameters']=[{'in':'header','name':'stripe-signature','required':True,'schema':S()}];route('/account/export','get',response=R('JsonRecord'));route('/account','delete',O({'password':S()}))
route('/agents','get',response=A(R('JsonRecord')))
agent=O({'name':S(minLength=1,maxLength=80),'provider':ai['provider'],'model':S(pattern='^[a-zA-Z0-9._:/-]{1,100}$'),'description':S(maxLength=500),'instructions':S(maxLength=2000),'enabled':B,'min_tier':S(enum=['free','pro']),'apiKey':S(minLength=8,maxLength=4096,writeOnly=True),'clearKey':B,'version':I(minimum=1),'totp':S(maxLength=6)},['name','provider','model'])
settings=O({'ai_enabled':B,'free_daily_limit':I(minimum=0,maximum=10000),'pro_daily_limit':I(minimum=0,maximum=10000),'free_daily_budget_usd':N(minimum=0,maximum=10000),'pro_daily_budget_usd':N(minimum=0,maximum=10000),'announcement':O({l:S(maxLength=500) for l in ['en','pl','de']},['en','pl','de']),'version':I(minimum=1),'totp':S(maxLength=6)},['ai_enabled','free_daily_limit','pro_daily_limit','free_daily_budget_usd','pro_daily_budget_usd','announcement','version'])
for p in ['overview','users','agents','jobs','audit','settings']:route('/admin/'+p,'get',response=R('JsonRecord'),query={'page':I(minimum=1),'search':S(maxLength=254)} if p in ['users','audit'] else {})
route('/admin/agents','post',agent,R('JsonRecord'))
route('/admin/agents/{id}','put',agent,R('JsonRecord'))
route('/admin/agents/{id}','delete',O({'version':I(minimum=1),'totp':S(maxLength=6)},['version']))
route('/admin/agent-tests','post',O({'agentId':uuid,'totp':S(maxLength=6)},['agentId']),R('JsonRecord'))
route('/admin/users/{id}','patch',O({'role':S(enum=['user','admin']),'suspended':B,'totp':S(maxLength=6)},['role','suspended']))
route('/admin/settings','put',settings,R('JsonRecord'))
route('/admin/job-cancellations','post',O({'id':uuid,'totp':S(maxLength=6)},['id']))
for p,ops in paths.items():
 if p.startswith('/admin/'):
  for op in ops.values():op['description']='Administrator role required. Mutations require current TOTP when the administrator has 2FA enabled. Secrets are write-only; reads expose configuration metadata only.'
api={'openapi':'3.1.0','info':{'title':'CryptoSight AI API','version':'1.0.0','description':'Implemented routes. Shared JSON database-row responses allow documented SQL fields; analysis and mutation inputs have strict schemas. Authentication uses opaque cookie or native bearer sessions. Cookie writes require CSRF; all private writes require exact Origin. No real trading endpoints.'},'servers':[{'url':'/api/v1'}],'paths':paths,'components':{'securitySchemes':{'mobileBearer':{'type':'http','scheme':'bearer','bearerFormat':'Opaque mobile session'},'session':{'type':'apiKey','in':'cookie','name':'__Host-cryptosight','description':'cryptosight in development; __Host-cryptosight Secure cookie in production.'}},'schemas':schemas}}
(root/'packages/contracts/openapi.json').write_text(json.dumps(api,indent=2)+'\n')
print(len(paths),'paths',sum(map(len,paths.values())),'operations')

(root/'packages/contracts/routes.mjs').write_text('export const routes = '+json.dumps({k:list(v) for k,v in paths.items()},indent=2)+';\n')
