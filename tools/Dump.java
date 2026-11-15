import driftglass.Simulation;
public class Dump {
 public static void main(String[] a){
  double[][] configs={{100,.08,.25,36,5000,1729},{100,0,0,12,100,1},{1,-.2,.8,120,500,2147483646},{10000,.3,.8,120,1000,42},{50,.1,.001,1,777,71}};
  for(double[] c:configs){var r=Simulation.run(new Simulation.Config(c[0],c[1],c[2],(int)c[3],(int)c[4],(int)c[5]));
   System.out.printf("%.17g %.17g %.17g %.17g %.17g%n",r.mean(),r.sampleSD(),r.standardError(),r.exactMean(),r.exactStandardError());
   for(var v:r.fan())System.out.printf("%.17g %.17g %.17g %.17g %.17g %.17g %.17g%n",v.time(),v.p05(),v.median(),v.p95(),v.exact05(),v.exactMedian(),v.exact95());
   for(var p:r.traces())for(double v:p)System.out.println(v);
   for(double v:r.terminals())System.out.println(v);
   for(var v:r.convergence())System.out.printf("%d %.17g %.17g%n",v.count(),v.mean(),v.standardError());
  }
 }
}
