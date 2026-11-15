"""Independent direct-product GBM reference, Python standard library only."""
import json, math, statistics, subprocess
results=json.loads(subprocess.check_output(['node','tools/dump.mjs'],text=True))
checks=0;max_error=0

def near(a,b):
 global checks,max_error
 checks+=1;e=abs(a-b)/max(1,abs(a),abs(b));max_error=max(e,max_error)
 assert math.isfinite(a) and math.isfinite(b) and e<2e-11,(a,b,e)

def percentile(a,p):
 a=sorted(a);pos=(len(a)-1)*p;lo=int(pos);hi=math.ceil(pos)
 return (1-(pos-lo))*a[lo]+(pos-lo)*a[hi]

for result in results:
 c=result['config'];state=c['seed'];columns=[[c['start']]*c['paths']]+[[]for _ in range(c['months'])]
 for p in range(c['paths']):
  price=c['start']
  for k in range(1,c['months']+1):
   state=(16807*state)%2147483647;u=state/2147483647
   state=(16807*state)%2147483647;v=state/2147483647
   shock=math.sqrt(-2*math.log(u))*math.cos(2*math.pi*v)
   price*=math.exp((c['drift']-.5*c['volatility']**2)/12+c['volatility']/math.sqrt(12)*shock)
   columns[k].append(price)
   if p<12:near(price,result['traces'][p][k])
  near(price,result['terminals'][p])
 for k,row in enumerate(result['fan']):
  t=k/12
  for key,p in [('p05',.05),('median',.5),('p95',.95)]:near(percentile(columns[k],p),row[key])
  for key,p in [('exact05',.05),('exactMedian',.5),('exact95',.95)]:
   z=statistics.NormalDist().inv_cdf(p)
   near(c['start']*math.exp((c['drift']-.5*c['volatility']**2)*t+c['volatility']*math.sqrt(t)*z),row[key])
 terminal=columns[-1]
 for prefix in result['convergence']:
  values=terminal[:prefix['count']];near(statistics.fmean(values),prefix['mean']);near(statistics.stdev(values)/math.sqrt(len(values)),prefix['standardError'])
 near(statistics.fmean(terminal),result['mean']);near(statistics.stdev(terminal),result['sampleSD'])
print(f'{checks} independent Python comparisons passed; max relative error {max_error:.3g}')
