#' Internal function to check inputs
#'
#' The functions `check_...` return nothing but issue errors as needed.
#' The functions `process_...` return their input, modified if needed, and
#' issue errors as needed.
#'
#'
#' @author Thibaut Jombart
#'
#' @param x A named list of inputs for run_seirdv()

process_inputs <- function(x) {

  ## time: vector of time step 1:time is needed
  x$time <- process_time(x$time)

  ## n_populations: nb of populations
  x <- process_n_populations(x)

  ## initial states of all compartments
  ini_comp <- grep("ini", names(x), value = TRUE)
  for (comp in ini_comp) {
    x <- process_ini_compartment(x, comp)
  }

  ## check all rates
  ##
  ## note: some like interv_delay and interv_release are not actual rates, but
  ## need to be positive finite numbers so the checks on rates still apply
  rates <- c("beta", "sigma", "gamma", "interv_delay", "interv_release",
             "target_size")
  for (rate in rates) {
    check_rate(x[[rate]])
  }

  ## check all proportions
  proportions <- c("mu", "vacc_coverage", "vacc_efficacy", "diffusion",
                   "interv_efficacy", "interv_vacc_coverage")
  for (prop in proportions) {
    check_proportion(x[[prop]])
  }

  ## delta: matrix of spatial diffusion
  x <- process_delta(x)

  ## we only build the model engine instance if it is missing
  if (is.null(x$model)) {
    x$model <- build_seirdv()
  }
  stopifnot(inherits(x$model, "odin_model"))

  ## number of simulations
  check_rate(x$n_sims)
  stopifnot(x$n_sims >= 1)

  ## vaccination type
  x <- process_interv_vacc_type(x)

  # ## number of nodes used for parallelization
  # check_rate(x$n_nodes)
  # stopifnot(x$n_nodes >= 1)

  x
}
