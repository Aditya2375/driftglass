# Numerical contract

## Model

The assumed price process satisfies dS = μS dt + σS dW. Annual drift μ is the instantaneous expected simple-return rate, not a continuously compounded realized return or a historical estimate. Volatility σ is the diffusion scale of log returns per square-root year.

With Δt = 1/12, each monthly step adds (μ - σ²/2)Δt + σ√Δt Z to cumulative log growth, then sets S = S0 exp(log growth). Z is standard normal under the model. This is an exact GBM transition at the observation times, up to floating-point error; there is no Euler approximation. Between-month behavior is not simulated or tested for barriers.

At time t: mean = S0 exp(μt); median = S0 exp((μ - σ²/2)t); quantile(p) = median × exp(σ√t Φ^-1(p)). The 5% and 95% normal quantile constants are ±1.6448536269514722. The fan compares pointwise quantiles, not a simultaneous path band. Sample percentile interpolation uses index (N-1)p between adjacent sorted values.

The sample mean and M2 use Welford's update. Sample variance is M2/(N-1), estimated MCSE = sample SD/√N. The exact model MCSE is S0 exp(μT) × sqrt(expm1(σ²T)/N). It is the standard deviation of a Monte Carlo sample mean under ideal independent draws from this model. Neither MCSE is model or parameter uncertainty. Finite samples, especially of a highly skewed distribution, can estimate mean and variance poorly. No confidence interval or guaranteed error tolerance is asserted.

## Randomness

The original Park-Miller MINSTD recurrence is state = (16807 × state) mod 2147483647. Uniforms are state/2147483647, strictly between zero and one for supported seeds. The largest integer multiplication is below 2^53, exactly representable in JavaScript. Java uses long integer arithmetic.

Each normal draw consumes two successive uniforms: sqrt(-2 ln U1) cos(2πU2). The sine partner is discarded. Draws occur path first, then month. Increasing N preserves the sample prefix at a fixed monthly horizon; changing the horizon changes the stream alignment across paths. The first 12 paths are always shown if the overlay is enabled. A seed is a reproducibility control, not a cryptographic secret. The finite-state generator is a teaching choice, not a claim of production-quality independence or a statistical battery certification.

Java Math and browser Math can differ in last bits. Tests compare relative error using max(1, |a|, |b|) as the scale, rather than promising bit-identical transcendental arithmetic.

## Bounds and display

Engine: S0 from 1 to 10000; μ from -0.2 to 0.3; σ from 0 to 0.8; 1 to 120 monthly observations; 100 to 10000 paths; integer seed 1 to 2147483646. Monthly horizon and path count are integers. The browser offers horizons of 12, 36, 60 or 120 and path counts 100, 500, 1000, 5000 or 10000. Decimal input only; hexadecimal, separators, empty/nonfinite values and exponent notation are rejected. Invalid input keeps the previous *applied* results with an error; editing alone never updates them.

Price units are arbitrary. There are no dates, currencies, tickers or assumptions about dividends. Zero volatility gives deterministic identical endpoints; a single centered histogram bar is then shown. Otherwise, 24 equal-width log-price bins span the sample minimum to maximum and include the maximum in the last bin. Log bins are not a linear-price density estimate. Vertical histogram units are path counts, not probability density. Every terminal sample is counted.

The fan's vertical domain includes all plotted 5th/95th percentile values, plus all overlaid first-12 paths when enabled. It is not intended to show all simulated path extremes. Exact and simulated medians may overlap visually. Numeric monthly values are available in the expandable table. Values usually display two decimals; nonzero magnitudes below 0.01 use three significant digits. Internal values are not rounded before calculation.

## Checks

Java analytic/adversarial tests; full Java/JS comparisons across five bounded and edge configurations; independent Python direct-product paths and standard-library statistics/normal quantiles; actual built-Chrome form, reset, invalid-input, local-network and responsive checks. These are implementation checks, not empirical validation of GBM for a stock or evidence that the random generator meets a production statistical standard.
