#' Check validity of a proportion
#'
#' Internal function used in input checking.
#'
#' @author Thibaut Jombart
#'
#' @noRd
#'
#' @param x an atomic object to be checked
#'
check_proportion <- function(x) {

  stopifnot(
    is.numeric(x),
    length(x) == 1L,
    is.finite(x),
    x >= 0,
    x <= 1
  )

  invisible(NULL)
}

