#' Run stochastic simulations using an SEIRDV model
#'
#' This function runs epidemic simulations using a discrete, stochastic SEIRDV
#' model. The model uses a meta-population setting, with diffusion of the force
#' of infection across populations according to a spatial structure matrix.
#' Transmission is frequency-dependent. Intervention is optional; if used, it
#' starts with a user-specified delay after the first case, and stops after a
#' user-specified number of days without case. During intervention, transmission
#' is reduced, and additional vaccination can be implemented. The underlying
#' model implementation uses the _odin_ package, which recodes simulations in C
#' for computer-efficiency.
#'
#' @author Thibaut Jombart
#'
#' @param n_populations The number of populations in the meta-population.
#'   Defaults to 1.
#'
#' @param ini_S The initial number of susceptibles; if a single value is
#'   provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param ini_E The initial number of exposed individuals; if a single value is
#'   provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param ini_I The initial number of infected individuals; if a single value is
#'   provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param ini_R The initial number of recovered individuals; if a single value
#'   is provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param ini_D The initial number of death from the disease; if a single value
#'   is provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param ini_V The initial number of vaccinated individuals; if a single value
#'   is provided, it is recycled to create a vector of size `n_populations`.
#'   Defaults to 0.
#'
#' @param beta The rate of infection from contacts with infected individuals;
#'   defaults to 0.
#'
#' @param sigma The rate at which exposed individuals show symptoms, i.e. the
#'   inverse of the mean incubation time. Defaults to 0.
#'
#' @param gamma The rate at which infected individuals either die or recover,
#'   i.e. the inverse of the mean duration of illness. Defaults to 0.
#'
#' @param mu The case fatality ratio, i.e. the proportion of infected
#'   individuals who will die from the disease. Defaults to 0.
#'
#' @param vacc_coverage The proportion of the population vaccinated at every
#'   time step as part of routine vaccination. Defaults to 0.
#'
#' @param vacc_efficacy The proportion of vaccinated individuals who are
#'   actually protected from the disease. Defaults to 0.
#'
#' @param diffusion The proportion of the force of infection seeding infections
#'   in other populations. Only used if `delta` is not provided, in which case
#'   the spatial model assumes uniform diffusion across all external
#'   populations. Defaults to 0.
#'
#' @param delta An `n_populations` by `n_populations` matrix of spatial
#'   diffusion, where each term indicates the proportion of the force of
#'   infection going from a patch (row), to a patch (column). It will be
#'   row-standardised if it is not already (i.e. forcing all rows to sum to
#'   one). If provided, overrides `diffusion`. Defaults to `NULL`.
#'
#' @param interv_delay An `integer` indicating the number of days after the
#'   first I in a patch for intervention to start. Defaults to 1e30, so that
#'   intervention does not start.
#'
#' @param interv_efficacy The relative reduction in infectiousness of Is in
#'   populations in response mode. 1 means total reduction of transmission,
#'   while 0 means to impact of the response on transmission. Defaults to 0.
#'
#' @param interv_vacc_type An integer indicating the type of reactive
#'   vaccination to be used, as part of the response to epidemics; can be 1 for
#'   global vaccination (default), in which case a fixed proportion
#'   (`interv_vacc_coverage`) of the susceptible population is vaccinated at each
#'   type step, or 2 for targeted vaccination, in which case the number of
#'   susceptible getting vaccinated is a function of the number of cases in a
#'   patch, determined by `target_size`.
#'
#' @param interv_vacc_coverage The additional vaccine coverage of populations in
#'   response mode, expressed as a proportion of S vaccinated daily. Defaults to
#'   0.
#'
#' @param target_size The average number of people to be vaccinated for each
#'   infectious individual in a patch. Can be parameterised as the ring size for
#'   ring vaccination. Defaults to 0.
#'
#' @param interv_release An `integer` indicating the number of days without
#'   cases for the intervention to stop. Defaults to 21.
#'
#' @param time An `integer` specifying how many time steps the simulation should
#'   run for.
#'
#' @param model An instance of the SEIRDV generated by `odin`. Useful to avoid
#'   re-compiling the C layer of the model at each run. Defaults to `NULL`, in
#'   which case the model will be compiled.
#'
#' @param n_sims An `integer` indicating the number of independent simulations
#'   to run. Defaults to 1.
#'
#' @export
#'
#' @examples
#'

#' ## make connectivity matrix on a regular grid
#' n_pop <- 100
#' diffusion <- 0.01 #' 1% diffusion
#' xy <- expand.grid(1:10, 1:10)
#' connec_matrix <- 1*(as.matrix(dist(xy)) < 1.001)
#' diag(connec_matrix) <- 0 #' keep only neighbours
#' connec_matrix <- diffusion * prop.table(connec_matrix, 1)
#' diag(connec_matrix) <- 1 - diffusion
#' rowSums(connec_matrix)
#'
#' ## simulate epidemic
#' set.seed(1)
#' res <- run_seirdv(
#'   n_populations = n_pop,
#'   ini_S = 1e4,
#'   ini_I = rep(c(10, 0), c(1, n_pop - 1)),
#'   delta = connec_matrix,
#'   beta = 0.1,
#'   gamma = 1/21,
#'   sigma = 1/7,
#'   time = 365 * 5
#' )
#'
#' ## isolate infected from the output
#' dim(res)
#' I <- res[, grep("I", names(res))]
#'
#' ## visualize dynamics
#' matplot(res[, "step"], I,
#'         type = "l", lwd = 2, lty = 1, col = "#AA224166",
#'         main = "100 populations, S = 1000",
#'         ylab = "Number of infected",
#'         xlab = "Time (days)"
#' )
#'
#' ## overall numbers of cases
#' plot(res[, "step"], rowSums(I),
#'      type = "l", col = 2,
#'      main = "Total number of cases",
#'      ylab = "Number of infected (across all population)",
#'      xlab = "Time (days)"
#'      )
#'
#'
#' ## Simulate reactive vaccination
#' set.seed(1)
#' res <- run_seirdv(
#'   n_populations = 1,
#'   ini_S = 1000,
#'   ini_I = 1,
#'   beta = 0.4,
#'   gamma = 1/14,
#'   sigma = 1/7,
#'   time = 60,
#'   interv_delay = 10,
#'   interv_vacc_type = 2,
#'   target_size = 5,
#'   vacc_efficacy = 0.95
#' )
#' matplot(res[, "step"], res[, 5:8],
#'         type = "l", lwd = 2, lty = 1,
#'         main = "Reactive, targeted vaccination",
#'         ylab = "Number of individuals",
#'         xlab = "Time (days)"
#' )
#' legend(
#'   "topright", col = 1:4, lty = 1, lwd = 3, legend = names(res)[5:8]
#' )
run_seirdv <- function(n_populations = 1,
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
                       diffusion = 0,
                       delta = NULL,
                       interv_delay = 1e30,
                       interv_efficacy = 0,
                       interv_vacc_type = 1L,
                       interv_vacc_coverage = 0,
                       target_size = 0,
                       interv_release = 21,
                       time = 1,
                       model = NULL,
                       n_sims = 1) {
  ## capture arguments
  inputs <- as.list(environment())

  ## process inputs
  ## - The function process_inputs does all the checking and processing on all
  ##   inputs
  ## - We separate inputs for the odin model from the rest
  ##
  inputs <- process_inputs(inputs)
  is_odin_input <- names(inputs) %in% names(inputs$model$contents())
  odin_inputs <- inputs[is_odin_input]

  ## change model inputs
  ## note the importance of creating a copy of the model instance so parameters
  ## are only modified for the copy, not the original model
  model <- inputs$model
  do.call(what = model$set_user, args = odin_inputs)

  # Run simulations
  #
  # Note that in epirs, by convention out time steps have the form 1:n odin
  # gives inconsistent results when time = 1, as it returns results for 2 steps,
  # 0 and 1. We need to fix this artificially by running simulations for 1:2 and
  # then keeping only the first row of results.

  if (length(inputs$time) == 1L) {
    out <- lapply(
      seq_len(n_sims),
      function(i)
        model$run(1:2)[1, , drop = FALSE]
    )
  } else {
     out <- lapply(
      seq_len(n_sims),
      function(i)
        model$run(inputs$time)
    )
  }

  ## reshape output into a single data.frame, where the first column indicates
  ## the simulation
  out <- lapply(
    seq_along(out),
    function(i) cbind.data.frame (sim = i, out[[i]])
    )

  Reduce(rbind.data.frame, out)
}
