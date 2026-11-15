# driftglass

[Live demo](https://aditya2375.github.io/driftglass/)

A Java-first Monte Carlo stock-model lab. Simulate geometric Brownian motion, compare the sample with exact lognormal answers, and see why more paths do not mean a more trustworthy market model.

No ticker, historical calibration, market feed, keys, accounts or trades. All inputs are assumptions. The browser computes locally with no requests or saved state.

## What it does

- Exact GBM transitions at monthly observation times, with fixed drift and volatility.
- Pointwise simulated 5th/50th/95th percentiles beside exact model quantiles. These are not simultaneous path coverage bands.
- Optional first 12 generated paths, not selected best or worst paths.
- Terminal log-price histogram containing every endpoint; sample and exact means; sample and exact Monte Carlo standard errors.
- Nested-sample convergence table, reproducible seeds, strict bounded decimal inputs and a monthly numeric table for the charts.

The first 12 paths and convergence prefixes use a fixed path-major random stream. Increasing the path count keeps the earlier paths. Changing the seed changes the sample, not the exact answer. Changing the horizon changes the number of draws per path, so it does not preserve the same later path shocks.

## Run

Requires Java 21+, Node 22+ and Python 3 for all reference tests. No application dependencies or package install.

```sh
javac -d build/classes src/driftglass/*.java tests/driftglass/*.java tools/*.java
java -cp build/classes driftglass.TestRunner
node tests/parity.mjs
python3 tests/reference.py
node tools/build-web.mjs
python3 -m http.server 8965 --bind 127.0.0.1 --directory docs
```

Open the local server's address in a browser. `node tests/browser-smoke.mjs` starts its own local server and tests the built app in `google-chrome`; that executable must be available. Run it after building. The browser test uses ports 8965 and 9366 and cleans up its processes. `SMOKE_SHOTS=1` also writes local screenshots, which are ignored by git.

The reference implementation is `src/driftglass/Simulation.java`. `web/src/model.js` is a separate browser implementation. The static host serves only the generated `docs/` files; it does not execute Java. `tests/reference.py` uses independently accumulated products, Python's statistics functions and NormalDist quantiles, rather than only checking two implementations of the same arithmetic.

## Meaning and limits

See [NUMERICS.md](NUMERICS.md) for equations, parameter bounds, random stream, interpolation and precision. Monte Carlo error is sampling error *inside the assumed model*, not a stock forecast interval. High volatility and long horizons make the right tail important and the finite-sample mean/MCSE less stable. The model omits jumps, volatility clustering, dividends, bankruptcy, financing, inflation and costs. Monthly observations miss between-observation movements.

No dataset, fitted parameters or market-performance claims are included. A sample minimum is not a maximum loss. This is educational software, not a production risk engine or investment advice.

## Sources

- [Random Services: geometric Brownian motion](https://www.randomservices.org/random/brown/Geometric.html), distribution, moments and quantiles.
- [NIST: lognormal distribution](https://itl.nist.gov/div898/handbook/eda/section3/eda3669.htm), noting that its parameter names differ from GBM drift/volatility.
- [Mike Giles, Oxford, Monte Carlo methods (2013), lecture 1](https://people.maths.ox.ac.uk/~gilesm/mc2013/lec1.pdf), sampling error and sample variance.
- [Rama Cont (2001), Empirical properties of asset returns](https://iopscience.iop.org/article/10.1088/1469-7688/1/2/304), heavy tails and volatility clustering in financial returns.
- [Park & Miller (1988), Random number generators: good ones are hard to find](https://dl.acm.org/doi/10.1145/63039.63042).
- [Box & Muller (1958), A Note on the Generation of Random Normal Deviates](https://doi.org/10.1214/aoms/1177706645).

No paper text, source code, data, figures or fonts from those sources are redistributed. Equations are implemented in original code. System fonts only.

## License

Original code, tests, documentation and examples: **MIT OR Apache-2.0**, at your choice. See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
