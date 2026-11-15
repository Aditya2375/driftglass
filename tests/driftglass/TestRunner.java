package driftglass;
import java.util.Arrays;
public class TestRunner{
 static int checks;
 static void ok(boolean b,String name){checks++;if(!b)throw new AssertionError(name);}
 static void near(double a,double b,double eps,String n){ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),n);}
 static void bad(Runnable r){try{r.run();throw new AssertionError("accepted bad config");}catch(IllegalArgumentException e){checks++;}}
 public static void main(String[]args){
  var rng=new Simulation.Random(1);near(rng.uniform()*2147483647,16807,0,"PRNG1");near(rng.uniform()*2147483647,282475249,0,"PRNG2");
  near(Simulation.quantile(new double[]{0,10},.05),.5,0,"interpolation");near(Simulation.quantile(new double[]{5},.9),5,0,"singleton");
  bad(()->Simulation.quantile(new double[]{},.5));bad(()->Simulation.quantile(new double[]{1},Double.NaN));bad(()->new Simulation.Random(0));
  var c=new Simulation.Config(100,.08,.25,36,5000,1729);var r=Simulation.run(c);
  near(r.exactMean(),100*Math.exp(.24),1e-14,"exact mean");near(r.fan()[36].exactMedian(),100*Math.exp((.08-.25*.25/2)*3),1e-14,"exact median");
  near(r.standardError(),r.sampleSD()/Math.sqrt(5000),1e-14,"SE sample");near(r.exactStandardError(),r.exactMean()*Math.sqrt(Math.expm1(.25*.25*3)/5000),1e-14,"SE theory");
  ok(Math.abs(r.mean()-r.exactMean())<6*r.exactStandardError(),"mean six SE sanity");
  var repeat=Simulation.run(c);ok(Arrays.equals(r.terminals(),repeat.terminals()),"repeat exact");
  var prefix=Simulation.run(new Simulation.Config(100,.08,.25,36,100,1729));ok(Arrays.equals(Arrays.copyOf(r.terminals(),100),prefix.terminals()),"nested sample");near(r.convergence()[0].mean(),prefix.mean(),0,"prefix mean");
  var flat=Simulation.run(new Simulation.Config(100,.08,0,120,100,1));for(var row:flat.fan()){
   near(row.p05(),row.median(),0,"zero spread");near(row.p95(),row.exact95(),1e-13,"deterministic transition");
  }near(flat.standardError(),0,0,"zero SE");
  for(var row:r.fan()){ok(row.p05()>0&&row.p05()<=row.median()&&row.median()<=row.p95(),"ordered positive quantiles");}
  for(int i=0;i<12;i++){near(r.traces()[i][0],100,0,"trace start");near(r.traces()[i][36],r.terminals()[i],0,"trace terminal");}
  for(double x:new double[]{Double.NaN,Double.POSITIVE_INFINITY,0,10001})bad(()->new Simulation.Config(x,.08,.25,12,100,1));
  for(double x:new double[]{Double.NaN,Double.NEGATIVE_INFINITY,-.201,.301})bad(()->new Simulation.Config(100,x,.25,12,100,1));
  for(double x:new double[]{Double.NaN,Double.POSITIVE_INFINITY,-.001,.801})bad(()->new Simulation.Config(100,.08,x,12,100,1));
  for(int x:new int[]{0,121})bad(()->new Simulation.Config(100,.08,.25,x,100,1));for(int x:new int[]{99,10001})bad(()->new Simulation.Config(100,.08,.25,12,x,1));
  bad(()->new Simulation.Config(100,.08,.25,12,100,0));
  var edge=Simulation.run(new Simulation.Config(10000,.3,.8,120,10000,2147483646));ok(Arrays.stream(edge.terminals()).allMatch(x->Double.isFinite(x)&&x>0),"max finite positive");
  System.out.println(checks+" Java checks passed");
 }
}
