#' Process n_populations: the number of populations
#'
#' @noRd
#' @author Thibaut Jombart
#' @param x A list of inputs for run_seirdv()

process_n_populations <- function(x) {
  ## n_populations: nb of populations
  if (!is.null(x$n_populations)) {
    stopifnot(
      is.numeric(x$n_populations),
      x$n_populations > 0,
      is.finite(x$n_populations),
      length(x$n_populations) == 1L
    )
    x$n_populations <- as.integer(x$n_populations)
  }
  x
}
