import json
import logging
from django.core.management.base import BaseCommand
import numpy as np

from predictions.scenarios.wbepi_engine.fitting import fit_parameters, fit_with_bootstrap
from predictions.scenarios.wbepi_engine import run_seirdv

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Fit parameters from case data and run an SEIRDV simulation'

    def add_arguments(self, parser):
        parser.add_argument(
            '--pathogen',
            type=str,
            default='cholera',
            help='Pathogen ID for priors (e.g., cholera, ebola)'
        )
        parser.add_argument(
            '--cases',
            type=str,
            required=True,
            help='Comma-separated list of cumulative case counts (e.g., "10,25,50,100")'
        )
        parser.add_argument(
            '--times',
            type=str,
            required=True,
            help='Comma-separated list of observation times in days (e.g., "0,7,14,21")'
        )
        parser.add_argument(
            '--initial-s',
            type=float,
            required=True,
            help='Initial susceptible population size'
        )
        parser.add_argument(
            '--initial-i',
            type=float,
            default=1.0,
            help='Initial infectious population size (default: 1.0)'
        )
        parser.add_argument(
            '--n-bootstrap',
            type=int,
            default=0,
            help='Number of bootstrap iterations for CI. If 0, only does a point fit.'
        )
        parser.add_argument(
            '--sim-horizon',
            type=int,
            default=90,
            help='Simulation horizon in days (default: 90)'
        )
        parser.add_argument(
            '--n-sims',
            type=int,
            default=10,
            help='Number of stochastic simulations to run (default: 10)'
        )

    def handle(self, *args, **options):
        pathogen = options['pathogen']
        cases_str = options['cases']
        times_str = options['times']
        initial_s = options['initial_s']
        initial_i = options['initial_i']
        n_bootstrap = options['n_bootstrap']
        sim_horizon = options['sim_horizon']
        n_sims = options['n_sims']

        try:
            cases = np.array([float(x.strip()) for x in cases_str.split(',')])
            times = np.array([float(x.strip()) for x in times_str.split(',')])
        except ValueError:
            self.stderr.write("Error: --cases and --times must be comma-separated numbers.")
            return

        if len(cases) != len(times):
            self.stderr.write(f"Error: length of cases ({len(cases)}) != length of times ({len(times)}).")
            return

        self.stdout.write(self.style.WARNING(f"Starting parameter fit for '{pathogen}'..."))
        self.stdout.write(f"Observations: {len(cases)} data points")
        self.stdout.write(f"Initial S: {initial_s}, Initial I: {initial_i}")

        if n_bootstrap > 0:
            self.stdout.write(f"Running bootstrap fit ({n_bootstrap} iterations)...")
            fit_result = fit_with_bootstrap(
                pathogen_id=pathogen,
                observed_cumulative_cases=cases,
                time_grid=times,
                initial_S=initial_s,
                initial_I=initial_i,
                n_bootstrap=n_bootstrap
            )
        else:
            self.stdout.write("Running point fit...")
            fit_result = fit_parameters(
                pathogen_id=pathogen,
                observed_cumulative_cases=cases,
                time_grid=times,
                initial_S=initial_s,
                initial_I=initial_i
            )

        if not fit_result.converged:
            self.stderr.write(self.style.ERROR("Fitting failed to converge!"))
            if fit_result.notes:
                self.stderr.write(f"Notes: {fit_result.notes}")
            return

        self.stdout.write(self.style.SUCCESS("Fit successful!"))
        self.stdout.write("=" * 40)
        self.stdout.write("Point Estimates:")
        for k, v in fit_result.point_estimate.items():
            self.stdout.write(f"  {k}: {v:.6f}")
            
        if n_bootstrap > 0 and fit_result.ci_lower:
            self.stdout.write(f"Bootstrap 95% CI (based on {fit_result.n_bootstrap} successes):")
            for k in fit_result.point_estimate.keys():
                low = fit_result.ci_lower.get(k, 0)
                high = fit_result.ci_upper.get(k, 0)
                self.stdout.write(f"  {k}: [{low:.6f}, {high:.6f}]")
                
        self.stdout.write(f"RMSE: {fit_result.rmse:.4f}")
        self.stdout.write("=" * 40)

        self.stdout.write(self.style.WARNING(f"\nRunning {n_sims} stochastic simulations for {sim_horizon} days..."))

        # Extract the point estimates for simulation
        beta = fit_result.point_estimate['beta']
        sigma = fit_result.point_estimate['sigma']
        gamma = fit_result.point_estimate['gamma']
        mu = fit_result.point_estimate['mu']

        try:
            df = run_seirdv(
                n_populations=1,
                ini_S=[initial_s],
                ini_I=[initial_i],
                beta=beta,
                sigma=sigma,
                gamma=gamma,
                mu=mu,
                time=sim_horizon,
                n_sims=n_sims,
                # Default intervention params (no intervention)
                interv_delay=0,
                interv_efficacy=0.0,
                interv_vacc_type=1,
                target_size=0,
                interv_release=0,
                diffusion=0.0
            )
            
            # The df output from run_seirdv contains columns like step, sim, S[1], E[1]...
            # We will show the median cumulative cases at the end of the simulation.
            # Cumulative cases = initial_S - S at final time step
            
            final_time_df = df[df['step'] == df['step'].max()]
            final_cases = initial_s - final_time_df['S[1]']
            
            p50 = np.percentile(final_cases, 50)
            p05 = np.percentile(final_cases, 5)
            p95 = np.percentile(final_cases, 95)
            
            self.stdout.write(self.style.SUCCESS("Simulation complete!"))
            self.stdout.write(f"Projected cumulative cases at day {sim_horizon}:")
            self.stdout.write(f"  Median (p50): {int(p50)}")
            self.stdout.write(f"  90% UI: [{int(p05)}, {int(p95)}]")
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Simulation failed: {e}"))
