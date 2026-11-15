package driftglass;

import java.util.Arrays;

/** Exact GBM at monthly observation times. All rates are annual decimals. */
public final class Simulation {
    private Simulation() {}
    public record Config(double start, double drift, double volatility, int months, int paths, int seed) {
        public Config {
            if (!Double.isFinite(start) || start < 1 || start > 10000 ||
                !Double.isFinite(drift) || drift < -.2 || drift > .3 ||
                !Double.isFinite(volatility) || volatility < 0 || volatility > .8 ||
                months < 1 || months > 120 || paths < 100 || paths > 10000 || seed < 1 || seed > 2147483646)
                throw new IllegalArgumentException("Parameters outside supported range");
        }
    }
    public static final class Random {
        private long state;
        public Random(int seed) {
            if (seed < 1 || seed > 2147483646) throw new IllegalArgumentException("Invalid seed");
            state = seed;
        }
        public double uniform() { state = (state * 16807L) % 2147483647L; return state / 2147483647.0; }
        public double normal() { return Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()); }
    }
    public record Row(double time, double p05, double median, double p95, double exact05, double exactMedian, double exact95) {}
    public record Prefix(int count, double mean, double standardError) {}
    public record Result(Config config, Row[] fan, double[][] traces, double[] terminals,
                         Prefix[] convergence, double mean, double sampleSD, double standardError,
                         double exactMean, double exactStandardError) {}
    public static double quantile(double[] sorted, double p) {
        if (sorted.length == 0 || !Double.isFinite(p) || p < 0 || p > 1) throw new IllegalArgumentException("Invalid quantile");
        double h=(sorted.length-1)*p;int i=(int)Math.floor(h),j=Math.min(i+1,sorted.length-1);
        return sorted[i]+(h-i)*(sorted[j]-sorted[i]);
    }
    public static double exact(double start, double mu, double sigma, double t, double z) {
        return start*Math.exp((mu-.5*sigma*sigma)*t+sigma*Math.sqrt(t)*z);
    }
    public static Result run(Config c) {
        final double z=1.6448536269514722,dt=1.0/12;
        double[][] at = new double[c.months+1][c.paths];
        double[][] traces = new double[12][c.months+1];
        Random random = new Random(c.seed);
        double mean=0,m2=0;int prefixIndex=0;
        int[] counts={100,250,500,1000,2500,5000,10000};
        Prefix[] prefixes = new Prefix[(int)Arrays.stream(counts).filter(n->n<=c.paths).count() + (Arrays.stream(counts).anyMatch(n->n==c.paths)?0:1)];
        for (int i=0;i<c.paths;i++) {
            double log=0;at[0][i]=c.start;if(i<12)traces[i][0]=c.start;
            for(int k=1;k<=c.months;k++) {
                log+=(c.drift-.5*c.volatility*c.volatility)*dt+c.volatility*Math.sqrt(dt)*random.normal();
                double value=c.start*Math.exp(log);at[k][i]=value;if(i<12)traces[i][k]=value;
            }
            double v=at[c.months][i], delta=v-mean;mean+=delta/(i+1);m2+=delta*(v-mean);
            int n=i+1;
            if(Arrays.stream(counts).anyMatch(x->x==n)||n==c.paths) prefixes[prefixIndex++]=new Prefix(n,mean,Math.sqrt(m2/(n-1)/n));
        }
        double[] terminals=at[c.months].clone();
        Row[] fan=new Row[c.months+1];
        for(int k=0;k<=c.months;k++) {
            Arrays.sort(at[k]);double t=k/12.0;
            fan[k]=new Row(t,quantile(at[k],.05),quantile(at[k],.5),quantile(at[k],.95),
                exact(c.start,c.drift,c.volatility,t,-z),exact(c.start,c.drift,c.volatility,t,0),exact(c.start,c.drift,c.volatility,t,z));
        }
        double t=c.months/12.0,exactMean=c.start*Math.exp(c.drift*t);
        return new Result(c,fan,traces,terminals,prefixes,mean,Math.sqrt(m2/(c.paths-1)),Math.sqrt(m2/(c.paths-1)/c.paths),
            exactMean,exactMean*Math.sqrt(Math.expm1(c.volatility*c.volatility*t)/c.paths));
    }
}
