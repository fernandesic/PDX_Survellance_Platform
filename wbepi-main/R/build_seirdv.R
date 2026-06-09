#' Function to create a SEIRDV model
#'
#' This function creates an odin instance of the stochastic, discrete SEIRDV
#' model. Since parameter inputs can be specified at runtime at no cost, this
#' function is used for internal purposes only. See `run_seirdv()` for running
#' simulations using this model.
#'
#' @author Thibaut Jombart

build_seirdv <- function() {
  seirdv$new(
    n_populations = 1,
    ini_S = 0,
    ini_E = 0,
    ini_I = 0,
    ini_R = 0,
    ini_D = 0,
    ini_V = 0,
    beta = 0,
    sigma = 0,
    gamma = 0,
    mu = 0,
    vacc_coverage = 0,
    vacc_efficacy = 0,
    interv_delay = 1e30,
    interv_efficacy = 0,
    interv_vacc_type = 1L,
    interv_vacc_coverage = 0,
    target_size = 0,
    interv_release = 21,
    delta = diag(1)
  )

}
